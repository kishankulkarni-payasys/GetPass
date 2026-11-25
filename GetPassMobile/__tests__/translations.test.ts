import { translateText } from '../src/i18n/translations';

describe('mobile translations', () => {
  it('translates exact interface text into Hindi and Marathi', () => {
    expect(translateText('Close', 'hi')).toBe('बंद करें');
    expect(translateText('Close', 'mr')).toBe('बंद करा');
  });

  it('keeps values in translated placeholder strings', () => {
    expect(translateText('Page 4', 'hi')).toBe('पेज 4');
    expect(translateText('Open passes first, longest on site first. Dwell turns red after 30 minutes.', 'hi'))
      .toBe('खुले पास पहले, सबसे ज़्यादा देर से साइट पर वाले पहले। 30 मिनट के बाद ठहराव लाल हो जाता है।');
    expect(translateText('Delete Kishan? This cannot be undone.', 'mr'))
      .toBe('Kishan हटवायचे? ही कृती पूर्ववत करता येणार नाही.');
    expect(translateText('Accepted + rejected is 10, the challan says 12.', 'hi'))
      .toBe('स्वीकृत + अस्वीकृत 10 है, चालान में 12 है।');
  });

  it('keeps standardized date format tokens unchanged', () => {
    expect(translateText('DD-MM-YYYY', 'hi')).toBe('DD-MM-YYYY');
  });

  it('translates app-specific labels and native confirmation text', () => {
    expect(translateText('Needs both weights before it can leave.', 'mr'))
      .toBe('बाहेर जाण्यापूर्वी दोन्ही वजने नोंदवणे आवश्यक आहे.');
    expect(translateText('MH12AB1234 has been let out.', 'hi'))
      .toBe('MH12AB1234 को बाहर जाने दिया गया है।');
  });

  it('preserves whitespace and leaves unmapped text unchanged', () => {
    expect(translateText(' Close ', 'mr')).toBe(' बंद करा ');
    expect(translateText('A vehicle-specific value', 'hi')).toBe('A vehicle-specific value');
  });
});
