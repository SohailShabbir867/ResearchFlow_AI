const fs = require('fs');
const path = require('path');

const pagesDir = 'C:\\Users\\Sohail Shabbir\\Desktop\\medresearch-ai\\frontend\\src\\pages';


const pages = ['DocumentManager', 'QueryAuditLog', 'SystemSettings', 'SystemHealth'];

pages.forEach(name => {
  const filePath = path.join(pagesDir, name + '.jsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Replace ThemeToggle import with AdminSidebar import
  content = content.replace(
    'import ThemeToggle from "../components/ThemeToggle.jsx";',
    'import AdminSidebar from "../components/layout/AdminSidebar.jsx";'
  );

  // 2. Replace mobileMenuOpen state with mobileOpen
  content = content.replace(
    /const \[mobileMenuOpen, setMobileMenuOpen\] = useState\(false\);/g,
    'const [mobileOpen, setMobileOpen] = useState(false);'
  );

  // 3. Remove activeNav state line entirely
  content = content.replace(
    /\n\s*const \[activeNav, setActiveNav\] = useState\("[^"]*"\);\n/g,
    '\n'
  );

  // 4. Replace the entire aside sidebar block with AdminSidebar component
  // The aside block starts with the backdrop overlay comment and ends with </aside>
  const startMarker = '      {/* Mobile Sidebar Backdrop';
  const endMarker = '      </aside>';
  
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + endMarker.length);
    const adminSidebarJSX = '\n      {/* Shared Admin Sidebar with working React Router navigation */}\n      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />';
    content = before + adminSidebarJSX + after;
    console.log(`  ✓ Replaced sidebar block in ${name}`);
  } else {
    console.log(`  ⚠ Could not find sidebar block in ${name} (start:${startIdx}, end:${endIdx})`);
  }

  // 5. Update root div className to use CSS variables
  content = content.replace(
    'className="flex h-screen w-full bg-[#0F0A1E] font-sans antialiased text-gray-100 overflow-hidden selection:bg-[#E21B70]/30 selection:text-white"',
    'className="flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed: ${name}.jsx`);
});

console.log('\nAll admin pages fixed!');
