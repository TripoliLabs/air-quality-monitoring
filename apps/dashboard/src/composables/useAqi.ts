import { type AqiCategory, aqiCategoryOrNull, aqiOnSolid, aqiSolid, aqiText } from '../lib/aqi';
import { useLocale } from './useLocale';
import { useTheme } from './usePrefs';

/** AQI colours and wording for the current theme and language. */
export function useAqi() {
  const { theme } = useTheme();
  const { t } = useLocale();

  const category = (aqi: number | null | undefined): AqiCategory | null => aqiCategoryOrNull(aqi);
  const id = (aqi: number | null | undefined): string => category(aqi)?.id ?? 'unknown';

  return {
    category,
    /** Fill colour for markers, bars and meters. */
    solid: aqiSolid,
    onSolid: aqiOnSolid,
    /** Text colour that is readable on the current theme's surfaces. */
    text: (aqi: number | null | undefined): string => aqiText(aqi, theme.value),
    name: (aqi: number | null | undefined): string => t(`aqi.names.${id(aqi)}`),
    shortName: (aqi: number | null | undefined): string => t(`aqi.short.${id(aqi)}`),
    advice: (aqi: number | null | undefined): string =>
      category(aqi) ? t(`aqi.advice.${id(aqi)}`) : '',
  };
}
