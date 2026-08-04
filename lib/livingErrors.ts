/** أخطاء بلغة كائن حي — لا مصطلحات تقنية للمستخدم أبدًا (الفصل 32). */
export const LIVING_ERRORS = {
  TIMEOUT: 'أفكر أبطأ قليلًا من المعتاد. لحظة واحدة.',
  NETWORK: 'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.',
  SERVER: 'أنا هنا. قد أكون محدودًا قليلًا الآن، لكنني أصغي.',
  RATE: 'لحظة هدوء قصيرة. أنا هنا عندما تعود.',
  LIMIT: 'طاقتي اليوم اقتربت من حدها. سأعود غدًا بكامل حضوري.',
  AUTH: 'أحتاج لحظة لأتأكد أنك أنت. أنا هنا.',
};
export function livingError(e: unknown): string {
  const m = String((e as any)?.message ?? e ?? '').toLowerCase();
  if (m.includes('مهلة') || m.includes('timeout')) return LIVING_ERRORS.TIMEOUT;
  if (m.includes('اتصال') || m.includes('network') || m.includes('fetch')) return LIVING_ERRORS.NETWORK;
  if (m.includes('429') || m.includes('هدوء')) return LIVING_ERRORS.RATE;
  if (m.includes('طاقتي') || m.includes('limit')) return LIVING_ERRORS.LIMIT;
  if (m.includes('401') || m.includes('authorization')) return LIVING_ERRORS.AUTH;
  return LIVING_ERRORS.SERVER;
}
