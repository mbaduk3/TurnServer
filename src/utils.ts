export function genKey(length:number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function shuffle(array:unknown[]) {
    let currentIndex = array.length, randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex > 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

export function removeFirst(src:unknown[], element:unknown) {
  const index = src.indexOf(element);
  if (index === -1) return src;
  src.splice(index, 1);
}

export function getRandomInt(min:number, max:number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export function isSubset(part:unknown[], whole:unknown[]) {
  let w = [...whole];
  for (const p of part) {
    const i = w.indexOf(p);
    if (i === -1) return false;
    w.splice(i, 1);
  }
  return true;
}

export function removeSubset(part:unknown[], whole:unknown[]) {
  let w = [...whole];
  part.forEach(p => {
    const i = w.indexOf(p);
    if (i !== -1) w = w.splice(i, 1);
  });
  return w;
}