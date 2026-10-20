/**
 * Tüm profil kartlarının ortak paleti (github_dark) ve küçük yardımcıları.
 */

export const FONT = "'Segoe UI', Ubuntu, Sans-Serif";

export const THEME = {
  bg: "#0D1117",
  border: "#e4e2e2",
  title: "#58A6FF",
  text: "#C3D1D9",
  dim: "#8B949E",
  white: "#FFFFFF",
  icon: "#1F6FEB",
  accent: "#39D353",
} as const;

/** README'de kartlar yan yana dizildiğinde 170px yükseklikteki satırın toplam genişliği */
export const ROW_WIDTH = 962;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
