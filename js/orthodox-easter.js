(function (global) {
  "use strict";

  /**
   * Расчёт православной Пасхи (юлианская формула + перевод в григорианский календарь).
   * Без внешнего API и без localStorage.
   */
  function getJulianToGregorianOffset(year) {
    if (year < 1583) return 0;
    if (year <= 1699) return 10;
    if (year <= 1799) return 11;
    if (year <= 1899) return 12;
    if (year <= 2099) return 13;
    if (year <= 2199) return 14;
    return 15;
  }

  function getOrthodoxEasterDate(year) {
    var numericYear = Number(year);
    if (!numericYear) return null;

    var a = numericYear % 4;
    var b = numericYear % 7;
    var c = numericYear % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var month = Math.floor((d + e + 114) / 31);
    var day = ((d + e + 114) % 31) + 1;

    var easter = new Date(numericYear, month - 1, day);
    easter.setDate(easter.getDate() + getJulianToGregorianOffset(numericYear));

    return {
      year: easter.getFullYear(),
      month: easter.getMonth(),
      day: easter.getDate(),
      date: easter
    };
  }

  function shiftEasterDate(easter, dayOffset) {
    if (!easter || !easter.date) return null;

    var shifted = new Date(easter.date.getTime());
    shifted.setDate(shifted.getDate() + dayOffset);

    return {
      year: shifted.getFullYear(),
      month: shifted.getMonth(),
      day: shifted.getDate(),
      date: shifted
    };
  }

  /**
   * Вербное воскресенье — за 7 дней до Пасхи.
   * Масленичная неделя — с понедельника (Пасха − 55) по Прощёное воскресенье (Пасха − 49).
   */
  function getOrthodoxMovableDates(year) {
    var easter = getOrthodoxEasterDate(year);
    if (!easter) return [];

    var palmSunday = shiftEasterDate(easter, -7);
    var maslenitsaStart = shiftEasterDate(easter, -55);
    var maslenitsaEnd = shiftEasterDate(easter, -49);

    return [
      {
        key: "maslenitsa-week",
        title: "Масленичная неделя",
        type: "religious-date",
        isRange: true,
        year: maslenitsaStart.year,
        month: maslenitsaStart.month,
        day: maslenitsaStart.day,
        endYear: maslenitsaEnd.year,
        endMonth: maslenitsaEnd.month,
        endDay: maslenitsaEnd.day
      },
      {
        key: "palm-sunday",
        title: "Вербное воскресенье",
        type: "religious-date",
        year: palmSunday.year,
        month: palmSunday.month,
        day: palmSunday.day
      }
    ];
  }

  global.MyDayOrthodoxEaster = {
    getOrthodoxEasterDate: getOrthodoxEasterDate,
    getOrthodoxMovableDates: getOrthodoxMovableDates
  };
})(window);
