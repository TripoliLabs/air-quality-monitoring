/**
 * Arabic translations
 */

export default {
  landing: {
    project: 'مشروع',
    openSource: 'شبكة مفتوحة المصدر لمراقبة جودة الهواء',
    tagline:
      'مراقبة جودة الهواء في الوقت الحقيقي لطرابلس، لبنان. أجهزة استشعار تعمل بالطاقة الشمسية تقيس PM2.5 و PM10 ودرجة الحرارة والرطوبة في جميع أنحاء المدينة.',
    exploreDashboard: 'استكشف لوحة التحكم',
    viewSource: 'عرض المصدر',
    learnMore: 'اعرف المزيد',
    stats: {
      sensors: 'أجهزة استشعار نشطة',
      aqi: 'متوسط AQI',
      neighborhoods: 'أحياء',
      monitoring: 'مراقبة',
    },
    about: {
      title: 'عن المشروع',
      subtitle: 'تحويل البيانات إلى فعل',
      description:
        'مشروع قلاوون هو مبادرة تكنولوجيا مدنية تجلب بيانات جودة الهواء الشفافة والفورية لسكان طرابلس. سُمي على اسم السلطان قلاوون الذي حرر المدينة عام 1289، ويهدف هذا المشروع إلى تحرير البيانات البيئية من الغموض.',
      description2:
        'في مدينة تعاني من انقطاعات متكررة للكهرباء وندرة في المراقبة البيئية، صممنا شبكة مرنة تتجاوز تحديات البنية التحتية—باستخدام الطاقة الشمسية والراديو بعيد المدى والتكنولوجيا مفتوحة المصدر.',
    },
    features: {
      title: 'المميزات',
      subtitle: 'مبنية للصمود',
      solar: {
        title: 'تعمل بالطاقة الشمسية',
        description:
          'كل جهاز استشعار يعمل بالطاقة الشمسية مع احتياطي بطارية 3-5 أيام، يعمل بشكل مستقل عن الشبكة أثناء انقطاع التيار.',
      },
      lorawan: {
        title: 'راديو بعيد المدى',
        description:
          'تقنية LoRaWAN تتيح مدى 5-10 كم لكل بوابة. البوابات فقط تحتاج الإنترنت—أجهزة الاستشعار تتواصل لاسلكياً.',
      },
      realtime: {
        title: 'بيانات فورية',
        description:
          'قياسات كل 5 دقائق، تُبث مباشرة إلى لوحة التحكم. تحديثات WebSocket تضمن رؤية البيانات فوراً.',
      },
      opensource: {
        title: 'مفتوح المصدر 100%',
        description:
          'كل الأكواد وتصاميم الأجهزة والبيانات عامة تحت رخصة AGPL-3.0. ابنِ خاصتك، ساهم، أو انسخها.',
      },
    },
    howItWorks: {
      title: 'كيف يعمل',
      subtitle: 'من جهاز الاستشعار إلى الشاشة',
      step1: {
        title: 'قياس',
        description:
          'أجهزة استشعار ESP32 مع قراءات PM2.5 و PM10 ودرجة الحرارة والرطوبة كل 5 دقائق.',
      },
      step2: {
        title: 'إرسال',
        description: 'راديو LoRaWAN يرسل البيانات إلى بوابات على مستوى المدينة بمدى 5-10 كم.',
      },
      step3: {
        title: 'معالجة',
        description: 'خادم شبكة ChirpStack يعالج الحزم، يحسب AQI، يخزن في TimescaleDB.',
      },
      step4: {
        title: 'عرض',
        description:
          'لوحة تحكم مباشرة مع خرائط ورسوم بيانية واتجاهات تاريخية—محدثة في الوقت الفعلي.',
      },
    },
    technology: {
      title: 'مجموعة التقنيات',
      subtitle: 'حديثة، مفتوحة، موثوقة',
      hardware: 'الأجهزة',
      software: 'البرمجيات',
      hardwareItems: {
        mcu: 'Heltec LoRa32 V3 (ESP32-S3)',
        pm: 'مستشعر جسيمات Plantower PMS5003',
        env: 'BME280 درجة الحرارة والرطوبة',
        power: '40W طاقة شمسية + بطارية LiFePO4',
      },
      softwareItems: {
        network: 'خادم ChirpStack LoRaWAN',
        database: 'TimescaleDB + Redis',
        api: 'NestJS REST API',
        frontend: 'Vue 3 + TypeScript + ECharts',
      },
    },
    contribute: {
      title: 'شارك معنا',
      subtitle: 'انضم إلى الحركة',
      description:
        'سواء كنت مطوراً، أو هاوياً للإلكترونيات، أو مناصراً للبيئة، أو مجرد شخص يهتم بالهواء النظيف—هناك مكان لك هنا.',
      github: 'ساهم على GitHub',
      docs: 'اقرأ التوثيق',
      community: 'انضم للمجتمع',
    },
    footer: 'صُنع بعناية لطرابلس بواسطة TripoliLabs. مرخص AGPL-3.0.',
  },
  dashboard: {
    title: 'لوحة التحكم',
    cityAverage: 'متوسط AQI للمدينة',
    trend24h: 'اتجاه 24 ساعة',
    activeSensors: 'أجهزة نشطة',
    avgAqi: 'متوسط AQI',
    worstArea: 'أسوأ منطقة',
    bestArea: 'أفضل منطقة',
    lastUpdate: 'آخر تحديث',
    allSensors: 'جميع أجهزة الاستشعار',
  },
  map: {
    title: 'خريطة جودة الهواء',
    layer: 'الطبقة',
    layerAqi: 'AQI',
    layerPm25: 'PM2.5',
    layerTemp: 'الحرارة',
    layerHumidity: 'الرطوبة',
  },
  aqi: {
    current: 'جودة الهواء الحالية',
    good: 'جيد',
    moderate: 'معتدل',
    unhealthySensitive: 'غير صحي للفئات الحساسة',
    unhealthy: 'غير صحي',
    veryUnhealthy: 'غير صحي جداً',
    hazardous: 'خطر',
  },
  sensors: {
    title: 'أجهزة الاستشعار',
    count: '{count} جهاز استشعار',
    empty: 'لا توجد أجهزة استشعار متاحة',
    name: 'الاسم',
    neighborhood: 'الحي',
    search: 'بحث عن أجهزة الاستشعار...',
    status: 'الحالة',
  },
  neighborhood: {
    sensors: 'أجهزة الاستشعار',
    averages: 'متوسطات الحي',
    backToDashboard: 'العودة إلى لوحة المعلومات',
  },
  sensor: {
    details: 'تفاصيل جهاز الاستشعار',
    location: 'الموقع',
    metadata: 'البيانات الوصفية',
    id: 'معرف الجهاز',
    battery: 'البطارية',
    signal: 'قوة الإشارة',
    installed: 'تاريخ التركيب',
    backToDashboard: 'العودة إلى لوحة التحكم',
  },
  readings: {
    current: 'القراءات الحالية',
    history: 'البيانات التاريخية',
    temperature: 'درجة الحرارة',
    humidity: 'الرطوبة',
    pressure: 'الضغط الجوي',
  },
  about: {
    title: 'حول المشروع',
    subtitle: 'تحويل البيانات إلى فعل',
    description:
      'هذه شبكة مفتوحة المصدر لمراقبة جودة الهواء في طرابلس، لبنان. نستخدم أجهزة استشعار LoRaWAN تعمل بالطاقة الشمسية لقياس PM2.5 و PM10 ودرجة الحرارة والرطوبة في جميع أنحاء المدينة.',
    mission: 'مهمتنا',
    missionText:
      'توفير بيانات دقيقة وفورية عن جودة الهواء لسكان طرابلس، مما يمكّنهم من اتخاذ قرارات مستنيرة بشأن الصحة والوعي البيئي.',
    openSource: 'مفتوح المصدر',
    openSourceText:
      'هذا المشروع مرخص بموجب AGPL-3.0. جميع الأكواد وتصاميم الأجهزة والبيانات متاحة مجاناً للمجتمع.',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    about: 'حول',
    analytics: 'التحليلات',
    health: 'صحة الأجهزة',
    features: 'المميزات',
    apiDocs: 'توثيق API',
    more: 'المزيد',
  },
  footer: {
    project: 'المشروع',
    tagline: 'مراقبة جودة الهواء مفتوحة المصدر لطرابلس، لبنان.',
    quickLinks: 'روابط سريعة',
    community: 'المجتمع',
    viewSource: 'عرض المصدر',
    license: 'AGPL-3.0',
    copyright: '© 2025 TripoliLabs. صُنع بعناية لطرابلس.',
  },
  download: {
    title: 'تحميل البيانات',
    dateRange: 'نطاق التاريخ',
    from: 'من',
    to: 'إلى',
    sensors: 'أجهزة الاستشعار',
    selectAll: 'تحديد الكل',
    format: 'الصيغة',
    readingsCount: '{count} قراءة',
    download: 'تحميل',
    noData: 'لا توجد بيانات متاحة للفلاتر المحددة.',
  },
  analytics: {
    title: 'التحليلات والرؤى',
    subtitle: 'تحليل مبني على البيانات لجودة الهواء في طرابلس',
    neighborhoodComparison: 'مقارنة الأحياء',
    hourlyProfile: 'ملف AQI بالساعة',
    pm25VsTemp: 'PM2.5 مقابل درجة الحرارة',
    aqiDistribution: 'توزيع AQI',
    topPolluted: 'أكثر المناطق تلوثاً',
    rank: 'الترتيب',
    neighborhood: 'الحي',
    avgAqi: 'متوسط AQI',
    avgPm25: 'متوسط PM2.5',
    sensorCount: 'الأجهزة',
  },
  featuresPage: {
    title: 'المميزات',
    subtitle: 'ما يميز مشروع قلاوون',
    current: 'المميزات الحالية',
    upcomingTitle: 'خارطة الطريق والقادم',
    comingSoon: 'قريباً',
    techStack: 'مجموعة التقنيات',
    features: {
      realtime: {
        title: 'مراقبة فورية',
        description:
          'بيانات مباشرة من أجهزة الاستشعار كل 5 دقائق عبر WebSocket، مع تحديثات فورية للوحة التحكم.',
      },
      maps: {
        title: 'خرائط تفاعلية',
        description:
          'خرائط مدعومة بـ MapLibre GL JS مع علامات ملونة حسب AQI وتجميع وحدود الأحياء.',
      },
      network: {
        title: 'شبكة متعددة الأجهزة',
        description:
          '52 جهاز استشعار عبر 10 أحياء توفر تغطية شاملة على مستوى المدينة.',
      },
      bilingual: {
        title: 'دعم ثنائي اللغة',
        description:
          'دعم كامل للعربية والإنجليزية مع تخطيط RTL ومحتوى محلي وتبديل اللغة.',
      },
      solar: {
        title: 'تعمل بالطاقة الشمسية',
        description:
          'كل عقدة استشعار تعمل بالطاقة الشمسية مع احتياطي بطارية 3-5 أيام للاستقلالية عن الشبكة.',
      },
      lorawan: {
        title: 'اتصال LoRaWAN',
        description:
          'مدى 5-10 كم لكل بوابة باستخدام راديو LoRaWAN. البوابات فقط تحتاج الوصول للإنترنت.',
      },
    },
    upcoming: {
      mobile: {
        title: 'تطبيق الهاتف',
        description:
          'تطبيق أصلي لـ iOS و Android مع إشعارات فورية وتنبيهات بناءً على الموقع.',
      },
      alerts: {
        title: 'تنبيهات وإشعارات',
        description:
          'عتبات AQI قابلة للتخصيص مع تنبيهات البريد الإلكتروني والرسائل القصيرة والإشعارات الفورية.',
      },
      openaq: {
        title: 'تكامل OpenAQ',
        description:
          'مشاركة تلقائية للبيانات مع منصة OpenAQ العالمية لجودة الهواء لتأثير أوسع.',
      },
      reports: {
        title: 'تقارير تاريخية',
        description:
          'تقارير أسبوعية وشهرية قابلة للتحميل عن جودة الهواء مع تحليل الاتجاهات.',
      },
      api: {
        title: 'واجهة برمجة عامة',
        description:
          'واجهة برمجة RESTful للمطورين للوصول إلى بيانات جودة الهواء الفورية والتاريخية.',
      },
    },
  },
  health: {
    title: 'لوحة صحة الأجهزة',
    subtitle: 'مراقبة حالة وأداء أسطول أجهزة الاستشعار',
    totalSensors: 'إجمالي الأجهزة',
    online: 'متصل',
    offline: 'غير متصل',
    maintenance: 'صيانة',
    avgBattery: 'متوسط البطارية',
    avgSignal: 'متوسط الإشارة',
    batteryLevels: 'مستويات البطارية',
    signalStrength: 'قوة الإشارة',
    statusOverview: 'نظرة عامة على الحالة',
    healthAlerts: 'تنبيهات الصحة',
    alertLowBattery: '{count} أجهزة أقل من 30% بطارية',
    alertWeakSignal: '{count} أجهزة بإشارة ضعيفة',
    alertOffline: '{count} أجهزة غير متصلة',
    alertMaintenance: '{count} أجهزة في الصيانة',
    noAlerts: 'جميع الأجهزة تعمل بشكل طبيعي',
    sensorHealth: 'جدول صحة الأجهزة',
    name: 'الاسم',
    neighborhood: 'الحي',
    status: 'الحالة',
    battery: 'البطارية %',
    signal: 'الإشارة dBm',
    lastReading: 'آخر قراءة',
  },
  apiDocs: {
    title: 'توثيق واجهة البرمجة',
    subtitle: 'مرجع واجهة برمجة REST العامة لبيانات جودة الهواء',
    comingSoon:
      'واجهة البرمجة العامة قيد التطوير حالياً. فيما يلي معاينة للنقاط النهائية المخططة.',
    baseUrl: 'العنوان الأساسي',
    authentication: 'المصادقة',
    authNote:
      'ستكون مفاتيح API مطلوبة لعمليات الكتابة. نقاط النهاية للقراءة فقط ستكون متاحة للعموم مع تحديد المعدل.',
    endpoints: 'نقاط النهاية',
    sensors: 'أجهزة الاستشعار',
    neighborhoods: 'الأحياء',
    aqiLabel: 'مؤشر جودة الهواء',
    exportLabel: 'تصدير',
    websocket: 'WebSocket',
    rateLimiting: 'تحديد المعدل',
    rateLimitNote:
      'نقاط النهاية العامة محدودة بـ 100 طلب في الدقيقة لكل عنوان IP. الطلبات المصادق عليها لها حدود أعلى.',
    parameter: 'المعامل',
    type: 'النوع',
    required: 'مطلوب',
    description: 'الوصف',
    exampleResponse: 'مثال على الاستجابة',
    yes: 'نعم',
    no: 'لا',
  },
  common: {
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    retry: 'إعادة المحاولة',
  },
};
