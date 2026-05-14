import figlet from 'figlet';
import color from 'picocolors';

export function printBanner(text = 'FRAMEWRIGHT'): void {
  const banner = figlet.textSync(text, { font: 'ANSI Shadow' });
  const tinted = banner
    .split('\n')
    .map((line, i) => (i % 2 === 0 ? color.magenta(line) : color.cyan(line)))
    .join('\n');
  console.log('\n' + tinted);
  console.log(color.dim('  craft AI videos from your terminal · hyperframes + claude\n'));
}
