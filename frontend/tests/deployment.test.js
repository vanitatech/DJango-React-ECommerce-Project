import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basePath } from '../base-path.js';
import { apiBase, mediaUrl, storageKey } from '../src/utils/deployment.js';

test('root and sub-directory build paths are normalised and validated', () => {
    assert.equal(basePath(), '/');
    assert.equal(basePath('/demos/django-react-ecommerce'), '/demos/django-react-ecommerce/');
    for (const value of ['', 'demos/store', '//', '/../', '/a//b', '/a?b']) {
        assert.throws(() => basePath(value), /VITE_BASE_PATH/);
    }
});

test('API calls default to the frontend mount, preserving explicit backend URLs', () => {
    assert.equal(apiBase('/'), '');
    assert.equal(apiBase('/demos/django-react-ecommerce/'), '/demos/django-react-ecommerce');
    assert.equal(apiBase('/', 'http://localhost:8000/'), 'http://localhost:8000');
    assert.equal(apiBase('/demos/store/', ''), '');
});

test('media URLs never duplicate the mount path', () => {
    const prefix = '/demos/django-react-ecommerce';
    const origin = 'https://vanitatech.co.uk';
    assert.equal(mediaUrl(prefix + '/media/products/image.png', prefix, origin),
        origin + prefix + '/media/products/image.png');
    assert.equal(mediaUrl('/media/image.png', 'http://localhost:8000', origin),
        'http://localhost:8000/media/image.png');
    assert.equal(mediaUrl('https://images.example/image.png', prefix, origin),
        'https://images.example/image.png');
});

test('mounted stores namespace browser storage without changing root-hosted keys', () => {
    assert.equal(storageKey('access_token', '/'), 'access_token');
    assert.equal(storageKey('guest_cart', '/demos/store/'), 'vanitacart:/demos/store/:guest_cart');
    assert.notEqual(storageKey('access_token', '/demos/store/'), storageKey('access_token', '/demos/other/'));
});
