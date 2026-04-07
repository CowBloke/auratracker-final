import { describe, expect, it } from 'vitest';

import { getPageMetaForPath } from './page-meta';

describe('getPageMetaForPath', () => {
  it('returns static metadata for known routes', () => {
    expect(getPageMetaForPath('/games/doodle-jump')).toMatchObject({
      title: 'Doodle Jump',
    });
  });

  it('returns dynamic metadata for profile routes', () => {
    expect(getPageMetaForPath('/profile/123')).toMatchObject({
      title: 'Profil',
    });
  });

  it('humanizes unknown routes', () => {
    expect(getPageMetaForPath('/custom-page/weekly-report')).toMatchObject({
      title: 'Custom Page / Weekly Report',
    });
  });
});
