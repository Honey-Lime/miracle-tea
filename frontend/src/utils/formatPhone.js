/**
 * Форматирует номер телефона в формат +X (XXX) XXX-XX-XX
 * Поддерживает автоматическую подстановку кода страны 7 при вводе первых цифр,
 * а при превышении длины — сдвиг кода страны.
 * @param {string} value - сырой ввод
 * @returns {string} отформатированный номер
 */
export function formatPhone(value) {
  // Удаляем все нецифровые символы
  let cleaned = value.replace(/\D/g, "");

  // Определяем код страны и цифры номера
  let countryCode = "7";
  let digits = cleaned;

  // Если цифр 11 или больше, первая цифра становится кодом страны
  if (cleaned.length >= 11) {
    countryCode = cleaned.substring(0, 1);
    digits = cleaned.substring(1);
  } else {
    // Меньше 11 цифр — используем код страны по умолчанию 7,
    // но если первая цифра 7 или 8, считаем её кодом страны и не дублируем
    if (cleaned.length > 0 && (cleaned[0] === "7" || cleaned[0] === "8")) {
      // Пользователь уже ввёл код страны, используем его как countryCode
      countryCode = "7"; // всегда приводим к 7
      digits = cleaned.substring(1);
    } else {
      // Иначе введённые цифры — часть номера
      digits = cleaned;
    }
  }

  // Ограничиваем номер 10 цифрами (после кода страны)
  digits = digits.substring(0, 10);

  // Склеиваем код страны и цифры номера для единого представления
  const full = countryCode + digits;

  // Форматируем
  if (full.length === 0) return "";
  if (full.length === 1) return `+${full}`;
  if (full.length <= 4) return `+${full.substring(0, 1)} (${full.substring(1)}`;
  if (full.length <= 7)
    return `+${full.substring(0, 1)} (${full.substring(1, 4)}) ${full.substring(4)}`;
  if (full.length <= 9)
    return `+${full.substring(0, 1)} (${full.substring(1, 4)}) ${full.substring(4, 7)}-${full.substring(7)}`;
  return `+${full.substring(0, 1)} (${full.substring(1, 4)}) ${full.substring(4, 7)}-${full.substring(7, 9)}-${full.substring(9, 11)}`;
}

/**
 * Извлекает только цифры из отформатированного номера для отправки на сервер.
 * @param {string} formatted - отформатированный номер
 * @returns {string} цифры (например, "79201231212")
 */
export function extractPhoneDigits(formatted) {
  return formatted.replace(/\D/g, "");
}
