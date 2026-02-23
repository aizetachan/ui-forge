const esbuild = require('esbuild');
const fs = require('fs');

async function test() {
    const file = fs.readFileSync('/Users/santferal/ui-forge-repos/gends/src/components/AlertDialog/AlertDialog.tsx', 'utf-8');

    try {
        const result = await esbuild.transform(file, {
            loader: 'tsx',
            jsx: 'transform',
            jsxFactory: 'React.createElement',
            jsxFragment: 'React.Fragment',
            target: 'es2020',
            format: 'iife',
        });
        console.log(result.code);
    } catch (e) {
        console.log(e);
    }
}

test();
