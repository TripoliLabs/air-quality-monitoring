CREATE TABLE "readings" (
	"time" timestamp with time zone NOT NULL,
	"sensor_id" text NOT NULL,
	"pm25" double precision NOT NULL,
	"pm10" double precision NOT NULL,
	"temperature" double precision NOT NULL,
	"humidity" double precision NOT NULL,
	"pressure" double precision,
	"aqi" integer NOT NULL,
	"aqi_category" text,
	"battery_mv" integer,
	"signal_strength" integer,
	CONSTRAINT "readings_sensor_id_time_pk" PRIMARY KEY("sensor_id","time")
);
