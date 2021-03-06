import { getStorage, setStorage } from '~/storage';

describe('storage', () => {
  it('should store the object to local storage as a json string', () => {
    const key = 'foo';
    const val = { a: 1, b: 2 };
    setStorage(key, val);
    expect(window.localStorage.getItem(key)).toEqual(JSON.stringify(val));
  });

  it('should parse the stored json string', () => {
    const key = 'foo';
    const val = { a: 1, b: 2 };
    setStorage(key, val);
    expect(getStorage(key)).toEqual(val);
  });
});
