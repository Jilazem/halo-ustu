// Dünya sabitleri — sahnenin tek ölçü kaynağı (metre).
export const DUNYA = {
  halkaY: 112,            // halka döşeme kotu
  halkaDisYaricap: 55,    // 110 m çap (kabul ölçütü)
  halkaIcYaricap: 44,
  halkaKalinlik: 2.6,
  kuleler: [
    { x: -95, z: -8, yuk: 212, tabanR: 42, tepeR: 13, tohum: 11.7 },
    { x: 95, z: 7, yuk: 198, tabanR: 38, tepeR: 12, tohum: 41.3 }
  ],
  golY: -20,
  golMerkez: { x: 0, z: 128 },
  golYaricap: 52,
  bulutAlt: -330,
  bulutUst: -120,
  gunesYon: { x: 0.75, y: -0.055, z: -0.66 },   // ufkun hemen altında, kulelerin arkasında
  sisBaslangic: 520,
  sisBitis: 4200,
  karCizgisi: 150,
  karEgimSinir: 0.34      // normal.y bu değerin altında kar tutmaz
};

export function normalize3(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export const GUNES = normalize3(DUNYA.gunesYon);
