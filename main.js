/**
* uWaterloo Schedule Exporter
* (c) 2015-Present, Baraa Hamodi
*/

/**
 * Converts a Date object into the required calendar format.
 * @param {Object} date
 * @return {String} formatted date ('20150122')
 */
function getDateString(date) {
  var month = date.getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  var day = date.getDate();
  if (day < 10) {
    day = '0' + day;
  }
  return '' + date.getFullYear() + month + day;
}

/**
 * Converts a time string into the required calendar format.
 * @param {String} time ('4:30PM')
 * @return {String} formatted time ('163000')
 */
function getTimeString(time) {
  var timeString = time;
  if (time.match(/[AP]M/)) {
    var timeString = time.substr(0, time.length - 2);
  }
  var parts = timeString.split(':');
  if (parts[0].length !== 2) {
    parts[0] = '0' + parts[0];
  }
  timeString = parts.join('') + '00';
  if (time.match(/PM/) && parts[0] < 12) {
    timeString = (parseInt(timeString, 10) + 120000).toString();
  }
  return timeString;
}

/**
 * Combines date and time strings into the required calendar format.
 * @param {String} date ('20150122')
 * @param {String} time ('163000')
 * @return {String} formatted date and time string ('20150122T163000')
 */
function getDateTimeString(date, time) {
  return getDateString(date) + 'T' + getTimeString(time);
}

/**
 * Combines days of the week that an event occurs into the required calendar format.
 * @param {String} daysOfWeek ('MTWThF')
 * @return {String} formatted days of the week string ('MO,TU,WE,TH,FR')
 */
function getDaysOfWeek(daysOfWeek) {
  var formattedDays = [];
  if (daysOfWeek.match(/S[^a]/)) {
    formattedDays.push('SU');
  }
  if (daysOfWeek.match(/M/)) {
    formattedDays.push('MO');
  }
  if (daysOfWeek.match(/T[^h]/)) {
    formattedDays.push('TU');
  }
  if (daysOfWeek.match(/W/)) {
    formattedDays.push('WE');
  }
  if (daysOfWeek.match(/Th/)) {
    formattedDays.push('TH');
  }
  if (daysOfWeek.match(/F/)) {
    formattedDays.push('FR');
  }
  if (daysOfWeek.match(/S[^u]/)) {
    formattedDays.push('SA');
  }

  return formattedDays.join(',');
}

/**
 * Wraps calendar event content into the required calendar format.
 * @param {String} iCalContent
 * @return {String} formatted calendar content
 */
function wrapICalContent(iCalContent) {
  return 'BEGIN:VCALENDAR\n' +
    'VERSION:2.0\n' +
    'PRODID:-//Baraa Hamodi/uWaterloo Schedule Exporter//EN\n' +
    iCalContent +
    'END:VCALENDAR\n';
}

/**
 * Makes a best effort to determine the locale of the browser.
 * navigator.languages[0] is more accurate, but only exists in Firefox and Chrome.
 * navigator.language is more supported, but less accurate.
 * See: http://stackoverflow.com/a/31135571
 * @return {String} browser's locale
 */
function getLocale() {
  if (navigator.languages != undefined) {
    return navigator.languages[0];
  } else {
    return navigator.language;
  }
}

/**
 * Extracts course schedule info and creates a downloadable iCalendar (.ics) file.
 */
var main = function() {
  var iCalContentArray = [];
  var timezone = 'America/Toronto';
  var numberOfEvents = 0;

  moment.locale(getLocale());

  $('.PSGROUPBOXWBO').each(function() {
    var eventTitle = $(this).find('.PAGROUPDIVIDER').text().split(' - ');
    var courseCode = eventTitle[0];
    var courseName = eventTitle[1];
    var componentRows = $(this).find('.PSLEVEL3GRIDNBO').find('tr');

    componentRows.each(function() {
      var classNumber = $(this).find('span[id*="DERIVED_CLS_DTL_CLASS_NBR"]').text();
      var section = $(this).find('a[id*="MTG_SECTION"]').text();
      var component = $(this).find('span[id*="MTG_COMP"]').text();

      var prev = $(this).prev();
      while (classNumber.length === 1) {
        classNumber = prev.find('span[id*="DERIVED_CLS_DTL_CLASS_NBR"]').text();
        section = prev.find('a[id*="MTG_SECTION"]').text();
        component = prev.find('span[id*="MTG_COMP"]').text();
        prev = prev.prev();
      }

      var daysTimes = $(this).find('span[id*="MTG_SCHED"]').text();
      var startEndTimes = daysTimes.match(/\d\d?:\d\d([AP]M)?/g);

      if (startEndTimes) {
        var daysOfWeek = getDaysOfWeek(daysTimes.match(/[A-Za-z]* /)[0]);
        var startTime = startEndTimes[0];
        var endTime = startEndTimes[1];

        var room = $(this).find('span[id*="MTG_LOC"]').text();
        var instructor = $(this).find('span[id*="DERIVED_CLS_DTL_SSR_INSTR_LONG"]').text();
        var startEndDate = $(this).find('span[id*="MTG_DATES"]').text();

        // Start the event one day before the actual start date, then exclude it in an exception date
        // rule. This ensures an event does not occur on startDate if startDate is not on part of daysOfWeek.
        var startDate = moment(startEndDate.substring(0, 10), 'L').toDate();
        startDate.setDate(startDate.getDate() - 1);

        // End the event one day after the actual end date. Technically, the RRULE UNTIL field should
        // be the start time of the last occurrence of an event. However, since the field does not
        // accept a timezone (only UTC time) and Toronto is always behind UTC, we can just set the
        // end date one day after and be guaranteed that no other occurrence of this event.
        var endDate = moment(startEndDate.substring(13, 23), 'L').toDate();
        endDate.setDate(endDate.getDate() + 1);

        var iCalContent =
          'BEGIN:VEVENT\n' +
          'DTSTART;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\n' +
          'DTEND;TZID=' + timezone + ':' + getDateTimeString(startDate, endTime) + '\n' +
          'LOCATION:' + room + '\n' +
          'RRULE:FREQ=WEEKLY;UNTIL=' + getDateTimeString(endDate, endTime) + 'Z;BYDAY=' + daysOfWeek + '\n' +
          'EXDATE;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\n' +
          'SUMMARY:' + courseCode + ' (' + component + ') in ' + room + '\n' +
          'DESCRIPTION:' +
            'Course Name: ' + courseName + '\\n' +
            'Section: ' + section + '\\n' +
            'Instructor: ' + instructor + '\\n' +
            'Component: ' + component + '\\n' +
            'Class Number: ' + classNumber + '\\n' +
            'Days/Times: ' + daysTimes + '\\n' +
            'Start/End Date: ' + startEndDate + '\\n' +
            'Location: ' + room + '\\n\n' +
          'END:VEVENT\n';

        // Remove double spaces from content.
        iCalContent = iCalContent.replace(/\s{2,}/g, ' ');

        iCalContentArray.push(iCalContent);
        numberOfEvents++;
      }
    });
  });

  // If no events were found, notify the user. Otherwise, proceed to download the ICS file.
  if ($('.PATRANSACTIONTITLE').text().indexOf('Download') < 0) {
    if (numberOfEvents === 0) {
      $('.PATRANSACTIONTITLE').append(' (<a href="#">Download Schedule</a>)').click(function() {
        alert('Unable to create a schedule. No days or times were found on this page. Please make sure to be in List View.');
        return false;
      });
    } else {
      var studentName = $('#DERIVED_SSTSNAV_PERSON_NAME').text().toLowerCase();
      studentName = studentName.replace(/\ /g, '-');  // Replace spaces with dashes.
      var fileName = studentName + '-uw-class-schedule.ics';

      $('.PATRANSACTIONTITLE').append(
        ' (<a href="data:text/calendar;charset=UTF-8,' +
        encodeURIComponent(wrapICalContent(iCalContentArray.join(''))) +
        '" download="' + fileName + '">Download Schedule</a>)'
      );
    }
  }
};

// Start checking after user selects a study term.
$(document).ready(function() {
  $('.SSSBUTTON_CONFIRMLINK').click(function() {
    $('iframe').ready(function() {
      $('.SSSTABACTIVE').each(function() {
        if ($(this).text() === 'my class schedule') {
          setTimeout(function() {
            main();
          }, 2000);
        }
      });
    });
  });

  // Execute main function only when user is in the Enroll/my_class_schedule tab.
  $('.SSSTABACTIVE').each(function() {
    if ($(this).text() === 'my class schedule') {
      // Only display the download button when the user is in List View.
      if ($('.PSRADIOBUTTON')[0].checked) {
        main();
      }
    }
  });
});
