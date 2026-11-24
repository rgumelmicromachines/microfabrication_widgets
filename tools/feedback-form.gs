/**
 * Builds the feedback form for Microfabrication Interactive (Google Forms) and a spreadsheet for the answers.
 *
 * How to use (once, about 2 minutes):
 *   1. Open https://script.google.com while signed in to the Google account that should own the form.
 *   2. New project → replace the code with this file → Save.
 *   3. Choose the function createFeedbackForm and press Run; allow the requested access (Forms, Sheets).
 *   4. Open View → Logs (or the Execution log): it prints the public form link and the "lesson" entry id.
 *      Put both into assets/mfw.js (MFW.config.feedbackUrl and MFW.config.feedbackLessonEntry).
 *
 * No personal data is required: the form does not collect e-mail addresses and does not need a Google account;
 * a contact address is optional and only for a reply.
 */
function createFeedbackForm() {
  const form = FormApp.create('Microfabrication Interactive – feedback');
  form.setDescription(
    'Found an error, something that does not work, or a topic that is missing? Tell us here – no account needed.\n' +
    'Every number on the site should be traceable to the literature: if you correct a value, please name your source.\n' +
    'We do not collect any personal data; an e-mail address is optional and only used to reply to you.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);                 // true would force a Google sign-in
  form.setShowLinkToRespondAgain(true);
  form.setProgressBar(false);
  try { form.setRequireLogin(false); } catch (e) { /* only exists for Workspace domains */ }
  form.setConfirmationMessage('Thank you! Your feedback helps to keep the lessons correct and useful.');

  form.addMultipleChoiceItem()
    .setTitle('What is it about?')
    .setChoiceValues([
      'An error in a lesson (physics, a number, a formula or the text)',
      'Something does not work or looks wrong (display, controls, mobile)',
      'A new topic or lesson I would like to see',
      'An idea to improve an existing lesson',
    ])
    .showOtherOption(true)
    .setRequired(true);

  const lesson = form.addTextItem()
    .setTitle('Lesson')
    .setHelpText('Filled in automatically when you come from a lesson page; leave empty for a new topic.');

  form.addParagraphTextItem()
    .setTitle('Your feedback')
    .setHelpText('What did you see, and where (step, slider setting, figure)? For an error: what should it be?')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Source for a correction (optional)')
    .setHelpText('Book, paper, datasheet or standard – with page, table or DOI if you can.');

  // a link instead of a file-upload question: file uploads would force every respondent to sign in to Google
  form.addTextItem()
    .setTitle('Link to a screenshot (optional)')
    .setHelpText(
      'No account needed: open postimages.org (or imgbb.com), upload the screenshot, copy the "Link" it gives you and paste it here. ' +
      'Anyone with the link can see the image, so please check that it shows no personal data (names, e-mails, other tabs).')
    .setValidation(FormApp.createTextValidation().requireTextIsUrl().build());

  form.addCheckboxItem()
    .setTitle('Device (optional)')
    .setChoiceValues(['Laptop or desktop', 'Phone', 'Tablet', 'Projector in a lecture']);

  form.addMultipleChoiceItem()
    .setTitle('You are (optional)')
    .setChoiceValues(['Student', 'Lecturer or teaching assistant'])
    .showOtherOption(true);

  form.addTextItem()
    .setTitle('E-mail, only if you would like a reply (optional)')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  // answers go to a spreadsheet next to the form
  const ss = SpreadsheetApp.create('Microfabrication Interactive – feedback (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // forms created by a script may start unpublished – publish it so anyone with the link can answer
  try { if (typeof form.setPublished === 'function') form.setPublished(true); } catch (e) { /* older Forms */ }

  // the lesson question's entry id, so the site can pre-fill it (…/viewform?usp=pp_url&entry.<id>=<lesson>)
  const pre = form.createResponse().withItemResponse(lesson.createResponse('LESSON')).toPrefilledUrl();
  const entry = (pre.match(/entry\.(\d+)=LESSON/) || [])[1];

  Logger.log('Public form link (feedbackUrl):  ' + form.getPublishedUrl());
  Logger.log('Lesson entry id (feedbackLessonEntry):  ' + entry);
  Logger.log('Edit the form:  ' + form.getEditUrl());
  Logger.log('Responses spreadsheet:  ' + ss.getUrl());
}
