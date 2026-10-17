/**
 * Arabic names for Tripoli's neighbourhoods.
 *
 * The API stores one neighbourhood name per sensor, in Latin script and in
 * whatever spelling the person registering it used ("El Mina", "Al-Mina",
 * "Mina"). This table gives each known place its Arabic name; the lookup ignores
 * the article and punctuation so the common spellings all match. An unknown
 * place is shown as the API spells it.
 */

const ARABIC_NAMES: Record<string, string> = {
  mina: 'الميناء',
  tell: 'التل',
  tal: 'التل',
  abousamra: 'أبو سمرا',
  abusamra: 'أبو سمرا',
  zahrieh: 'الزاهرية',
  zahriyeh: 'الزاهرية',
  qobbeh: 'القبة',
  kobbeh: 'القبة',
  babaltabbaneh: 'باب التبانة',
  babtabbaneh: 'باب التبانة',
  tabbaneh: 'التبانة',
  downtown: 'وسط المدينة',
  azmi: 'عزمي',
  bahsas: 'البحصاص',
  portarea: 'منطقة المرفأ',
  port: 'المرفأ',
  dammwfarz: 'الضم والفرز',
  dammwalfarz: 'الضم والفرز',
  jabalmohsen: 'جبل محسن',
  mankoubin: 'المنكوبين',
  beddawi: 'البداوي',
  qalamoun: 'القلمون',
  maarad: 'المعرض',
  nejmeh: 'النجمة',
  souk: 'الأسواق',
  oldcity: 'المدينة القديمة',
};

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(al|el)[\s-]+/g, '')
    .replace(/[^a-z]/g, '');
}

/** The Arabic name of a neighbourhood, or undefined when it is not in the table. */
export function arabicPlaceName(name: string): string | undefined {
  return ARABIC_NAMES[normalise(name)];
}

/** Where the map opens: the centre of Tripoli, Lebanon. */
export const TRIPOLI_CENTER = { latitude: 34.4367, longitude: 35.8397, zoom: 12.6 } as const;
