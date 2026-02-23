const { RepoParser } = require('./dist/services/repoParser.js');
const fs = require('fs');
const path = require('path');

async function test() {
  const parser = new RepoParser();
  const repoPath = '/Users/santferal/ui-forge-repos/gends';
  const repoConfigPath = path.join(repoPath, 'forgecore.json');
  // Initialize with forgecore to load aliases
  await parser.parseRepo(repoPath);

  // But we want to see what it returned for AlertDialog
  const components = await parser.parseRepo(repoPath);
  const alertDialog = components.components.find(c => c.name === 'AlertDialog');
  console.log('AlertDialog rawCSS length:', alertDialog ? alertDialog.rawCSS.length : 'Not found');
}
test().catch(console.error);
