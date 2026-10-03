export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "getstock-theme";

/**
 * اسکریپت کوچکی که قبل از رندر صفحه در <head> اجرا می‌شود تا تم ذخیره‌شده (یا تم سیستم‌عامل
 * وقتی کاربر چیزی انتخاب نکرده) بدون چشمک‌زدن اعمال شود.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ذخیره‌سازی در دسترس نیست (حالت خصوصی و…)؛ تم فقط برای همین صفحه اعمال می‌شود.
  }
}
