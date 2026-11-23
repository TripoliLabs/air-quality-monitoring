"""Isolated Docker checks for production stores, MQTT queuing and logical restores.

Run: python scripts/test-production.py
Requires Docker Compose and Bash (BASH_PATH overrides the executable on Windows).
No production names, ports, credentials or volumes are used.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid


ROOT = Path(__file__).resolve().parents[1]


def run(*args, input=None, check=True):
    return subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          check=check, cwd=ROOT)


def main():
    project = "aq-review-" + uuid.uuid4().hex[:10]
    (ROOT / "tmp").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=project, dir=ROOT / "tmp") as directory:
        work = Path(directory)
        env = work / "test.env"
        keys = ["APP_DB_PASSWORD", "TSDB_PASSWORD", "REDIS_PASSWORD", "ADMIN_API_KEY",
                "MQTT_CHIRPSTACK_PASSWORD", "MQTT_GATEWAY_BRIDGE_PASSWORD",
                "MQTT_INGESTION_PASSWORD", "CHIRPSTACK_API_SECRET"]
        env.write_text("IMAGE_SHA=" + "a" * 40 + "\n" +
                       "".join(key + "=testonly\n" for key in keys))
        config = json.loads(run("docker", "compose", "--env-file", str(env), "-f",
                               "deploy/compose/docker-compose.prod.yml", "config", "--format", "json").stdout)
        published = {(name, port["published"], port["protocol"])
                     for name, service in config["services"].items()
                     for port in service.get("ports", [])}
        assert published == {("caddy", "80", "tcp"), ("caddy", "443", "tcp"),
                             ("chirpstack-gateway-bridge", "1700", "udp")}, published
        assert "MQTT_URL" not in config["services"]["api"]["environment"]
        services = {key: config["services"][key] for key in
                    ["postgres", "timescaledb", "redis", "mqtt", "chirpstack", "chirpstack-gateway-bridge"]}
        volumes = {}
        passwd = work / "mosquitto.passwd"
        passwd.write_text("chirpstack:testonly\ngateway_bridge:testonly\ningestion:testonly\n")
        run("docker", "run", "--rm", "-v", f"{passwd}:/tmp/passwd", "eclipse-mosquitto:2",
            "mosquitto_passwd", "-U", "/tmp/passwd")
        for name, service in services.items():
            service["container_name"] = project + "-" + name
            service.pop("ports", None)
            service["restart"] = "no"
            for volume in service.get("volumes", []):
                if volume["target"] == "/mosquitto/config/mosquitto.passwd":
                    volume["source"] = str(passwd)
                elif not volume.get("read_only"):
                    volume.clear()
                    volume.update(type="volume", source=name, target={
                        "postgres": "/var/lib/postgresql", "timescaledb": "/var/lib/postgresql",
                        "redis": "/data", "mqtt": "/mosquitto/data"}[name])
                    volumes[name] = {}
        stack = work / "stack.json"
        stack.write_text(json.dumps({"services": services, "networks": {"aq_net": {}}, "volumes": volumes}))
        compose = ["docker", "compose", "-p", project, "-f", str(stack)]
        try:
            run(*compose, "up", "-d", "--wait", "--wait-timeout", "90")
            before = run(*compose, "ps", "-q").stdout
            print("PASS: authenticated production backing services start; only intended ports are configured", flush=True)
            for database, service in [("relational", "postgres"), ("telemetry", "timescaledb")]:
                container = project + "-" + service
                dbname = "airquality" if database == "relational" else "telemetry"
                for migration in sorted((ROOT / "packages/db/migrations" / database).glob("*.sql")):
                    run("docker", "exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1",
                        "-U", "airquality", "-d", dbname, input=migration.read_bytes())
                fixture = ("INSERT INTO sensors(device_id,name,latitude,longitude,neighborhood) "
                           "VALUES ('test-node','Test',34.4,35.8,'Test');" if database == "relational" else
                           "INSERT INTO readings(time,sensor_id,pm25,pm10,temperature,humidity,aqi) "
                           "VALUES (now(),'test-node',12,20,25,60,50);")
                run("docker", "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "airquality",
                    "-d", dbname, "-c", fixture)
                dump = work / (database + ".dump")
                dump.write_bytes(run("docker", "exec", container, "pg_dump", "-U", "airquality",
                                     "-d", dbname, "-Fc").stdout)
                metadata = run("docker", "inspect", "--format", "{{.Config.Image}} {{.Image}}", container).stdout.decode().strip()
                Path(str(dump) + ".image").write_text(metadata + " airquality\n", newline="\n")
                Path(str(dump) + ".sha256").write_text(hashlib.sha256(dump.read_bytes()).hexdigest() + "  " + dump.name + "\n", newline="\n")
            bash = os.environ.get("BASH_PATH", "bash")
            drill_env = {**os.environ, "MSYS_NO_PATHCONV": "1"}
            subprocess.run([bash, "scripts/db-restore-drill.sh", work.as_posix() + "/relational.dump",
                            work.as_posix() + "/telemetry.dump"], check=True, cwd=ROOT, env=drill_env)
            print("PASS: both real database dumps restore through the production drill", flush=True)

            broker = project + "-mqtt"
            topic = "application/test/device/test-node/event/up"
            subscribe = ["docker", "exec", broker, "mosquitto_sub", "-h", "localhost", "-u", "ingestion",
                         "-P", "testonly", "-i", "aq-test-persistent", "-c", "-q", "1", "-t", topic, "-C", "1", "-W", "2"]
            # Establish persistent subscription, time out/disconnect, publish offline, reconnect.
            first = run(*subscribe, check=False)
            assert first.returncode == 27, first.stderr.decode()
            run("docker", "exec", broker, "mosquitto_pub", "-u", "chirpstack", "-P", "testonly",
                "-q", "1", "-t", topic, "-m", "queued-during-restart")
            assert run(*subscribe).stdout.strip() == b"queued-during-restart"
            # Ingestion is a subscriber only: QoS 1 publish must be rejected by the ACL.
            denied = run("docker", "exec", broker, "mosquitto_pub", "-V", "mqttv5", "-u", "ingestion",
                         "-P", "testonly", "-q", "1", "-t", topic, "-m", "forbidden", check=False)
            # Some mosquitto_pub versions report a negative PUBACK on stderr but
            # still exit zero. Verify the forbidden message was never delivered.
            forbidden_delivery = run(*subscribe, check=False)
            assert forbidden_delivery.returncode == 27 and not forbidden_delivery.stdout, (
                denied.stderr.decode(), forbidden_delivery.stdout.decode())
            assert run(*compose, "ps", "-q").stdout == before
            print("PASS: offline QoS 1 delivery and ingestion publish denial; backing containers unchanged", flush=True)
            # Allow network-server initialization to finish before checking for credential errors.
            time.sleep(2)
            logs = run(*compose, "logs", "--no-color", "chirpstack").stdout.decode()
            assert "error communicating with database" not in logs.lower(), logs
        except Exception:
            result = run(*compose, "logs", "--tail", "60", check=False)
            print(result.stdout.decode(errors="replace"))
            raise
        finally:
            run(*compose, "down", "-v", "--remove-orphans", check=False)


if __name__ == "__main__":
    main()
