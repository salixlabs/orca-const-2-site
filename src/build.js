const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Function to read template
async function readTemplate(templateName) {
    const template = await fs.readFile(path.join(__dirname, `templates/${templateName}.html`), 'utf-8');
    return template;
}

// Function to read partial
async function readPartial(partialName) {
    const partial = await fs.readFile(path.join(__dirname, `templates/partials/${partialName}.html`), 'utf-8');
    return partial;
}

// Function to process partials in template
async function processPartials(template) {
    const partialRegex = /{{>\s*([^}\s]+)}}/g;
    let match;
    let processedTemplate = template;
    
    while ((match = partialRegex.exec(template)) !== null) {
        const [fullMatch, partialName] = match;
        const partial = await readPartial(partialName);
        processedTemplate = processedTemplate.replace(fullMatch, partial);
    }
    
    return processedTemplate;
}

// Function to extract metadata from markdown
function extractMetadata(markdown) {
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const dateMatch = markdown.match(/\*Posted on ([^*]+)/m);
    const authorMatch = markdown.match(/by ([^*]+)\*/m);
    const tagsMatch = markdown.match(/Tags:\s*([^\n]+)/m);
    
    return {
        title: titleMatch ? titleMatch[1] : '',
        date: dateMatch ? dateMatch[1].trim() : '',
        author: authorMatch ? authorMatch[1].trim() : '',
        tags: tagsMatch ? tagsMatch[1].split(',').map(tag => tag.trim()) : []
    };
}

// Function to convert markdown to HTML
async function convertMarkdownFile(filePath, template, outputPath, isPost = false, baseUrl = '') {
    const markdown = await fs.readFile(filePath, 'utf-8');
    
    if (isPost) {
        const metadata = extractMetadata(markdown);
        const url = `${baseUrl}${outputPath.replace(path.join(__dirname, '..', 'dist'), '')}`;
        
        // Remove the title from content
        const contentWithoutTitle = markdown.replace(/^#\s+(.+)\n/, '');
        const content = marked(contentWithoutTitle);
        
        // Process template with partials
        let html = await processPartials(template);
        
        // Replace template placeholders for blog posts
        html = html
            .replace(/{{title}}/g, metadata.title)
            .replace(/{{date}}/g, metadata.date)
            .replace(/{{author}}/g, metadata.author)
            .replace(/{{url}}/g, url)
            .replace(/{{baseUrl}}/g, baseUrl)
            .replace('{{content}}', content);

        // Handle tags
        if (metadata.tags.length > 0) {
            const tagsHtml = metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('\n');
            html = html.replace('{{#if tags}}', '').replace('{{#each tags}}', '').replace('{{/each}}', '').replace('{{/if}}', '');
            html = html.replace('{{this}}', tagsHtml);
        } else {
            // Remove tags section if no tags
            html = html.replace(/{{#if tags}}[\s\S]*?{{\/if}}/g, '');
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html);
        return metadata;
    } else {
        // For regular pages
        const title = markdown.match(/^#\s+(.+)/m)?.[1] || path.basename(filePath, '.md');
        // Remove the title from content for regular pages too
        const contentWithoutTitle = markdown.replace(/^#\s+(.+)\n/, '');
        const content = marked(contentWithoutTitle);
        
        // Process template with partials
        let html = await processPartials(template);
        
        html = html
            .replace('{{title}}', title)
            .replace(/{{baseUrl}}/g, baseUrl)
            .replace('{{content}}', content);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html);
        return null;
    }
}

// Function to copy static assets
async function copyStaticAssets() {
    const publicDir = path.join(__dirname, 'public');
    const outputDir = path.join(__dirname, '..', 'dist');
    
    await fs.mkdir(outputDir, { recursive: true });
    await fs.cp(publicDir, path.join(outputDir), { recursive: true });
}

// Function to generate blog index
async function generateBlogIndex(posts, template) {
    const blogList = posts
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(post => `
            <div class="blog-card">
                <h2><a href="${post.url}">${post.title}</a></h2>
                <div class="blog-meta">
                    Posted on <time datetime="${post.date}">${post.date}</time> by <span class="author">${post.author}</span>
                </div>
                ${post.tags.length > 0 ? `
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('\n')}
                </div>` : ''}
            </div>
        `).join('');

    const indexContent = template.replace('<!-- Blog posts will be dynamically inserted here by the build script -->', blogList);
    await fs.writeFile(path.join(__dirname, '..', 'dist', 'blog.html'), indexContent);
}

// Main build function
async function build() {
    try {
        const baseTemplate = await readTemplate('base');
        const blogTemplate = await readTemplate('blog');
        
        // Create dist directory
        const distDir = path.join(__dirname, '..', 'dist');
        await fs.mkdir(distDir, { recursive: true });

        // Process pages directory
        const pagesDir = path.join(__dirname, 'pages');
        const pageFiles = await fs.readdir(pagesDir);
        
        for (const file of pageFiles) {
            const sourcePath = path.join(pagesDir, file);
            const outputPath = path.join(distDir, file);
            
            if (file.endsWith('.html')) {
                // Copy HTML files directly
                const content = await fs.readFile(sourcePath, 'utf-8');
                await fs.writeFile(outputPath, content);
            } else if (file.endsWith('.md')) {
                // Convert markdown files using template
                await convertMarkdownFile(
                    sourcePath,
                    baseTemplate,
                    path.join(distDir, file.replace('.md', '.html'))
                );
            }
        }

        // Process blog posts
        const blogDir = path.join(__dirname, 'blog');
        const posts = [];
        const baseUrl = '/Orca-Const-2-Site'; // Update for GitHub Pages
        
        try {
            const blogFiles = await fs.readdir(blogDir);
            for (const file of blogFiles) {
                if (file.endsWith('.md')) {
                    const outputPath = path.join(distDir, 'blog', file.replace('.md', '.html'));
                    const metadata = await convertMarkdownFile(
                        path.join(blogDir, file),
                        blogTemplate,
                        outputPath,
                        true,
                        baseUrl
                    );
                    if (metadata) {
                        posts.push({
                            ...metadata,
                            url: `./blog/${file.replace('.md', '.html')}`
                        });
                    }
                }
            }
        } catch (error) {
            console.log('No blog directory found, skipping blog posts');
        }

        // Generate blog index if we have posts
        if (posts.length > 0) {
            const blogIndexContent = await fs.readFile(path.join(pagesDir, 'blog.html'), 'utf-8');
            await generateBlogIndex(posts, blogIndexContent);
        }

        // Copy static assets
        await copyStaticAssets();
        
        // Create a .nojekyll file to prevent GitHub Pages from processing the site with Jekyll
        await fs.writeFile(path.join(distDir, '.nojekyll'), '');
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 