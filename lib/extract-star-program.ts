export function extractStarProgram(text: string): boolean|null {
  const re = /(Star\s+Savings|\w*\s*Star\s+-\s+School\s+Tax\s+Relief)/ig;
  let match: RegExpExecArray|null = null;

  do {
    match = re.exec(text);
    if (match) {
      return true;
    }
  } while (match);

  return false;
}
