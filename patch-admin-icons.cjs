const fs = require('fs');
let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

if (!content.includes('User, Stethoscope')) {
  content = content.replace(
    'import { \n  Users, AlertTriangle',
    'import { \n  User, Stethoscope, Users, AlertTriangle'
  );
}

content = content.replace(
  "{ name: 'GraduationCap', icon: <GraduationCap className=\"w-4 h-4\" /> }",
  "{ name: 'GraduationCap', icon: <GraduationCap className=\"w-4 h-4\" /> },\n  { name: 'User', icon: <User className=\"w-4 h-4\" /> },\n  { name: 'Stethoscope', icon: <Stethoscope className=\"w-4 h-4\" /> }"
);

fs.writeFileSync('src/components/AdminView.tsx', content);
console.log('patched icons in admin view');
