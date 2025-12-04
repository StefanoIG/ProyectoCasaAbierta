export function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Regex para detectar **texto** (negrita) y *texto* (cursiva)
  const markdownRegex = /\*\*([^\*]+)\*\*|\*([^\*]+)\*/g;
  let match;

  while ((match = markdownRegex.exec(text)) !== null) {
    // Texto antes del match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Texto del match
    if (match[1]) {
      // **texto** - negrita
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      // *texto* - cursiva
      parts.push(
        <em key={`italic-${match.index}`} className="italic">
          {match[2]}
        </em>
      );
    }

    lastIndex = markdownRegex.lastIndex;
  }

  // Texto restante
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Si no hay matches, retornar el texto original
  if (parts.length === 0) {
    return [text];
  }

  return parts;
}
