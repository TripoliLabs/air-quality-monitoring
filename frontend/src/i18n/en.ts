/**
 * English translations
 */

export default {
  landing: {
    project: 'Project',
    openSource: 'Open Source Air Quality Network',
    tagline:
      'Real-time air quality monitoring for Tripoli, Lebanon. Solar-powered sensors measuring PM2.5, PM10, temperature, and humidity across the city.',
    exploreDashboard: 'Explore Dashboard',
    viewSource: 'View Source',
    learnMore: 'Learn More',
    stats: {
      sensors: 'Active Sensors',
      aqi: 'Avg. AQI',
      neighborhoods: 'Neighborhoods',
      monitoring: 'Monitoring',
    },
    about: {
      title: 'About the Project',
      subtitle: 'Breathing Data Into Action',
      description:
        'Project Qalawun is a civic technology initiative that brings transparent, real-time air quality data to the people of Tripoli. Named after Sultan Qalawun, who liberated the city in 1289, this project aims to liberate environmental data from obscurity.',
      description2:
        "In a city where power outages are frequent and environmental monitoring is scarce, we've designed a resilient network that works around infrastructure challenges—using solar power, long-range radio, and open-source technology.",
    },
    features: {
      title: 'Features',
      subtitle: 'Built for Resilience',
      solar: {
        title: 'Solar Powered',
        description:
          'Each sensor runs on solar power with 3-5 days battery backup, operating independently of the grid during outages.',
      },
      lorawan: {
        title: 'Long-Range Radio',
        description:
          'LoRaWAN technology enables 5-10km range per gateway. Only gateways need internet—sensors communicate wirelessly.',
      },
      realtime: {
        title: 'Real-Time Data',
        description:
          'Measurements every 5 minutes, streamed live to the dashboard. WebSocket updates ensure you see data instantly.',
      },
      opensource: {
        title: '100% Open Source',
        description:
          'All code, hardware designs, and data are public under AGPL-3.0. Build your own, contribute, or fork it.',
      },
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: 'From Sensor to Screen',
      step1: {
        title: 'Measure',
        description:
          'ESP32 sensors with PM2.5, PM10, temperature & humidity readings every 5 minutes.',
      },
      step2: {
        title: 'Transmit',
        description: 'LoRaWAN radio sends data to city-wide gateways with 5-10km range.',
      },
      step3: {
        title: 'Process',
        description:
          'ChirpStack network server processes packets, calculates AQI, stores in TimescaleDB.',
      },
      step4: {
        title: 'Visualize',
        description:
          'Live dashboard with maps, charts, and historical trends—updated in real-time.',
      },
    },
    technology: {
      title: 'Technology Stack',
      subtitle: 'Modern, Open, Reliable',
      hardware: 'Hardware',
      software: 'Software',
      hardwareItems: {
        mcu: 'Heltec LoRa32 V3 (ESP32-S3)',
        pm: 'Plantower PMS5003 PM Sensor',
        env: 'BME280 Temperature & Humidity',
        power: '40W Solar + LiFePO4 Battery',
      },
      softwareItems: {
        network: 'ChirpStack LoRaWAN Server',
        database: 'TimescaleDB + Redis',
        api: 'NestJS REST API',
        frontend: 'Vue 3 + TypeScript + ECharts',
      },
    },
    contribute: {
      title: 'Get Involved',
      subtitle: 'Join the Movement',
      description:
        "Whether you're a developer, hardware tinkerer, environmental advocate, or just someone who cares about clean air—there's a place for you here.",
      github: 'Contribute on GitHub',
      docs: 'Read the Docs',
      community: 'Join Community',
    },
    footer: 'Built with care for Tripoli by TripoliLabs. AGPL-3.0 Licensed.',
  },
  map: {
    title: 'Air Quality Map',
  },
  aqi: {
    current: 'Current Air Quality',
    good: 'Good',
    moderate: 'Moderate',
    unhealthy: 'Unhealthy',
    veryUnhealthy: 'Very Unhealthy',
    hazardous: 'Hazardous',
  },
  sensors: {
    title: 'Sensors',
    count: '{count} sensors',
    empty: 'No sensors available',
  },
  sensor: {
    details: 'Sensor Details',
  },
  readings: {
    current: 'Current Readings',
    history: 'Historical Data',
    temperature: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure',
  },
  about: {
    title: 'About',
    description:
      'This is an open-source air quality monitoring network for Tripoli, Lebanon. We use solar-powered LoRaWAN sensors to measure PM2.5, PM10, temperature, and humidity across the city.',
    mission: 'Our Mission',
    missionText:
      'To provide accurate, real-time air quality data to the residents of Tripoli, enabling informed decisions about health and environmental awareness.',
    openSource: 'Open Source',
    openSourceText:
      'This project is licensed under AGPL-3.0. All code, hardware designs, and data are freely available to the community.',
  },
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Retry',
  },
};
