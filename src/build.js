const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Function to read template
async function readTemplate() {
    const template = await fs.readFile(path.join(__dirname, 'templates/base.html'), 'utf-8');
    return template;
}

// Function to convert markdown to HTML
async function convertMarkdownFile(filePath, template, outputPath) {
    const markdown = await fs.readFile(filePath, 'utf-8');
    const content = marked(markdown);
    
    // Extract title from first heading or use filename
    const title = markdown.match(/^#\s+(.+)/m)?.[1] || path.basename(filePath, '.md');
    
    // Replace template placeholders
    const html = template
        .replace('{{title}}', title)
        .replace('{{content}}', content);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html);
}

// Function to copy static assets
async function copyStaticAssets() {
    const publicDir = path.join(__dirname, 'public');
    const outputDir = path.join(__dirname, '..', 'dist');
    
    await fs.mkdir(outputDir, { recursive: true });
    await fs.cp(publicDir, path.join(outputDir), { recursive: true });
}

// Main build function
async function build() {
    try {
        const template = await readTemplate();
        
        // Create dist directory
        const distDir = path.join(__dirname, '..', 'dist');
        await fs.mkdir(distDir, { recursive: true });

        // Process pages
        const pagesDir = path.join(__dirname, 'pages');
        const pageFiles = await fs.readdir(pagesDir);
        for (const file of pageFiles) {
            if (file.endsWith('.md')) {
                const outputPath = path.join(distDir, file.replace('.md', '.html'));
                await convertMarkdownFile(path.join(pagesDir, file), template, outputPath);
            }
        }

        // Process blog posts
        const blogDir = path.join(__dirname, 'blog');
        const blogFiles = await fs.readdir(blogDir);
        for (const file of blogFiles) {
            if (file.endsWith('.md')) {
                const outputPath = path.join(distDir, 'blog', file.replace('.md', '.html'));
                await convertMarkdownFile(path.join(blogDir, file), template, outputPath);
            }
        }

        // Copy static assets
        await copyStaticAssets();
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 