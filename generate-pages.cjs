const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
if (!fs.existsSync(pagesDir)) {
  fs.mkdirSync(pagesDir, { recursive: true });
}

const pages = ['Dashboard', 'POS', 'Products', 'Inventory', 'Sales', 'Settings'];

pages.forEach(page => {
  const content = `import React from 'react';

export const ${page}: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-6">${page}</h1>
      <div className="flex-1 bg-white rounded-lg shadow p-6 flex items-center justify-center border border-gray-200">
        <p className="text-gray-500 text-lg">This is the placeholder for the ${page} module.</p>
      </div>
    </div>
  );
};
`;
  fs.writeFileSync(path.join(pagesDir, `${page}.tsx`), content);
});

console.log('Pages created successfully.');
