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
  dashboard: {
    title: 'Dashboard',
    cityAverage: 'City Average AQI',
    trend24h: '24h Trend',
    activeSensors: 'Active Sensors',
    avgAqi: 'Avg AQI',
    worstArea: 'Worst Area',
    bestArea: 'Best Area',
    lastUpdate: 'Last Update',
    allSensors: 'All Sensors',
  },
  map: {
    title: 'Air Quality Map',
    layer: 'Layer',
    layerAqi: 'AQI',
    layerPm25: 'PM2.5',
    layerTemp: 'Temp',
    layerHumidity: 'Humidity',
  },
  aqi: {
    current: 'Current Air Quality',
    good: 'Good',
    moderate: 'Moderate',
    unhealthySensitive: 'Unhealthy for Sensitive Groups',
    unhealthy: 'Unhealthy',
    veryUnhealthy: 'Very Unhealthy',
    hazardous: 'Hazardous',
  },
  sensors: {
    title: 'Sensors',
    count: '{count} sensors',
    empty: 'No sensors available',
    name: 'Name',
    neighborhood: 'Neighborhood',
    search: 'Search sensors...',
    status: 'Status',
  },
  neighborhood: {
    sensors: 'Sensors',
    averages: 'Neighborhood Averages',
    backToDashboard: 'Back to Dashboard',
  },
  sensor: {
    details: 'Sensor Details',
    location: 'Location',
    metadata: 'Metadata',
    id: 'Sensor ID',
    battery: 'Battery',
    signal: 'Signal Strength',
    installed: 'Installed',
    backToDashboard: 'Back to Dashboard',
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
    subtitle: 'Breathing Data Into Action',
    description:
      'This is an open-source air quality monitoring network for Tripoli, Lebanon. We use solar-powered LoRaWAN sensors to measure PM2.5, PM10, temperature, and humidity across the city.',
    mission: 'Our Mission',
    missionText:
      'To provide accurate, real-time air quality data to the residents of Tripoli, enabling informed decisions about health and environmental awareness.',
    openSource: 'Open Source',
    openSourceText:
      'This project is licensed under AGPL-3.0. All code, hardware designs, and data are freely available to the community.',
  },
  nav: {
    dashboard: 'Dashboard',
    about: 'About',
    analytics: 'Analytics',
    health: 'Health',
    features: 'Features',
    apiDocs: 'API Docs',
    more: 'More',
  },
  footer: {
    project: 'Project',
    tagline: 'Open-source air quality monitoring for Tripoli, Lebanon.',
    quickLinks: 'Quick Links',
    community: 'Community',
    viewSource: 'View Source',
    license: 'AGPL-3.0',
    copyright: '© 2025 TripoliLabs. Built with care for Tripoli.',
  },
  download: {
    title: 'Download Data',
    dateRange: 'Date Range',
    from: 'From',
    to: 'To',
    sensors: 'Sensors',
    selectAll: 'Select All',
    format: 'Format',
    readingsCount: '{count} readings',
    download: 'Download',
    noData: 'No data available for the selected filters.',
  },
  analytics: {
    title: 'Analytics & Insights',
    subtitle: 'Data-driven analysis of air quality across Tripoli',
    neighborhoodComparison: 'Neighborhood Comparison',
    hourlyProfile: 'Hourly AQI Profile',
    pm25VsTemp: 'PM2.5 vs Temperature',
    aqiDistribution: 'AQI Distribution',
    topPolluted: 'Top Polluted Areas',
    rank: 'Rank',
    neighborhood: 'Neighborhood',
    avgAqi: 'Avg AQI',
    avgPm25: 'Avg PM2.5',
    sensorCount: 'Sensors',
  },
  featuresPage: {
    title: 'Features',
    subtitle: 'What makes Project Qalawun unique',
    current: 'Current Features',
    upcomingTitle: 'Roadmap & Upcoming',
    comingSoon: 'Coming Soon',
    techStack: 'Technology Stack',
    features: {
      realtime: {
        title: 'Real-Time Monitoring',
        description:
          'Live sensor data streamed every 5 minutes via WebSocket, with instant dashboard updates.',
      },
      maps: {
        title: 'Interactive Maps',
        description:
          'MapLibre GL JS powered maps with AQI-colored markers, clustering, and neighborhood boundaries.',
      },
      network: {
        title: 'Multi-Sensor Network',
        description:
          '52 sensors across 10 neighborhoods providing comprehensive city-wide coverage.',
      },
      bilingual: {
        title: 'Bilingual Support',
        description:
          'Full Arabic and English support with RTL layout, localized content, and language toggle.',
      },
      solar: {
        title: 'Solar Powered',
        description:
          'Each sensor node runs on solar power with 3-5 days battery backup for grid independence.',
      },
      lorawan: {
        title: 'LoRaWAN Connectivity',
        description:
          '5-10km range per gateway using LoRaWAN radio. Only gateways need internet access.',
      },
    },
    upcoming: {
      mobile: {
        title: 'Mobile App',
        description:
          'Native mobile app for iOS and Android with push notifications and location-based alerts.',
      },
      alerts: {
        title: 'Alerts & Notifications',
        description:
          'Configurable AQI thresholds with email, SMS, and push notification alerts.',
      },
      openaq: {
        title: 'OpenAQ Integration',
        description:
          'Automatic data sharing with OpenAQ global air quality platform for broader impact.',
      },
      reports: {
        title: 'Historical Reports',
        description:
          'Downloadable weekly and monthly air quality reports with trend analysis.',
      },
      api: {
        title: 'Public API',
        description:
          'RESTful API for developers to access real-time and historical air quality data.',
      },
    },
  },
  health: {
    title: 'Sensor Health Dashboard',
    subtitle: 'Monitor the status and performance of the sensor fleet',
    totalSensors: 'Total Sensors',
    online: 'Online',
    offline: 'Offline',
    maintenance: 'Maintenance',
    avgBattery: 'Avg Battery',
    avgSignal: 'Avg Signal',
    batteryLevels: 'Battery Levels',
    signalStrength: 'Signal Strength',
    statusOverview: 'Status Overview',
    healthAlerts: 'Health Alerts',
    alertLowBattery: '{count} sensors below 30% battery',
    alertWeakSignal: '{count} sensors with weak signal',
    alertOffline: '{count} sensors offline',
    alertMaintenance: '{count} sensors in maintenance',
    noAlerts: 'All sensors operating normally',
    sensorHealth: 'Sensor Health Table',
    name: 'Name',
    neighborhood: 'Neighborhood',
    status: 'Status',
    battery: 'Battery %',
    signal: 'Signal dBm',
    lastReading: 'Last Reading',
  },
  apiDocs: {
    title: 'API Documentation',
    subtitle: 'Public REST API reference for air quality data',
    comingSoon:
      'The public API is currently under development. Below is a preview of the planned endpoints.',
    baseUrl: 'Base URL',
    authentication: 'Authentication',
    authNote:
      'API keys will be required for write operations. Read-only endpoints will be publicly accessible with rate limiting.',
    endpoints: 'Endpoints',
    sensors: 'Sensors',
    neighborhoods: 'Neighborhoods',
    aqiLabel: 'AQI',
    exportLabel: 'Export',
    websocket: 'WebSocket',
    rateLimiting: 'Rate Limiting',
    rateLimitNote:
      'Public endpoints are limited to 100 requests per minute per IP. Authenticated requests have higher limits.',
    parameter: 'Parameter',
    type: 'Type',
    required: 'Required',
    description: 'Description',
    exampleResponse: 'Example Response',
    yes: 'Yes',
    no: 'No',
  },
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Retry',
  },
};
