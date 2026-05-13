const { execSync } = require('child_process');

try {
    console.log('Staging changes...');
    execSync('git add .', { stdio: 'inherit' });
    console.log('Committing changes...');
    execSync('git commit -m "Fix: Robust User ID detection in Facebook OAuth callback"', { stdio: 'inherit' });
    console.log('Pushing to GitHub...');
    execSync('git push', { stdio: 'inherit' });
    console.log('✅ Success!');
} catch (error) {
    console.error('❌ Failed:', error.message);
}
