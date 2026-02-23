import { RepoParser } from './electron/services/repoParser';
import path from 'path';

async function test() {
  const parser = new RepoParser();
  const repoPath = '/Users/santferal/ui-forge-repos/gends';
  try {
    const result = await parser.parseRepository(repoPath);
    const alertDialog = result.components.find(c => c.name === 'AlertDialog');
    console.log('AlertDialog rawCSS length:', alertDialog ? alertDialog.rawCSS?.length : 'Not found');
    if (alertDialog?.rawCSS) {
      console.log('Does it include Button CSS?', alertDialog.rawCSS.includes('Button_'));
    }
  } catch (err) {
    console.error('FAILED', err);
  }
}
test();
