export default function wait<T>(pass: T): Promise<T> {
  return new Promise(function(resolve, _) {
    setTimeout(function() {
      resolve(pass);
    }, 10);
  });
}
