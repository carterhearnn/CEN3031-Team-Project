// Run against a local Firestore emulator only. Install @firebase/rules-unit-testing
// and firebase-tools as development tools, or set RULES_TEST_DEPENDENCIES to a
// separate directory containing them. Never point this test at a live project.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.RULES_TEST_DEPENDENCIES
  ? join(resolve(process.env.RULES_TEST_DEPENDENCIES), 'package.json') : import.meta.url);
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');

const address = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8088';
const match = address.match(/^(127\.0\.0\.1|localhost):(\d+)$/);
assert.ok(match, 'Rules tests require a loopback Firestore emulator.');
const environment = await initializeTestEnvironment({
  projectId: 'demo-gatorbyte',
  firestore: { host: match[1], port: Number(match[2]), rules: await readFile(join(root, 'firestore.rules'), 'utf8') },
});
const past = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const contexts = Object.fromEntries(['user', 'admin', 'owner', 'alias-admin', 'demoted-owner', 'invalid-role', 'new-user']
  .map((uid) => [uid, environment.authenticatedContext(uid).firestore()]));
const anonymous = environment.unauthenticatedContext().firestore();
const deal = (uid, overrides = {}) => ({
  link: 'https://example.com/item', userID: uid, status: 'pending',
  dateSubmitted: serverTimestamp(), dateApproved: null, upvotes: 0, ...overrides,
});
const wishlist = (uid, overrides = {}) => ({
  dealID: 'existing', name: 'Saved item', link: 'https://example.com/item', userID: uid,
  dateCreated: serverTimestamp(), ...overrides,
});
let passed = 0;
async function check(name, test) {
  await test();
  passed++;
  console.log(`PASS ${name}`);
}

try {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, role] of [['user', 0], ['admin', 1], ['owner', 2], ['managed', 0]]) {
      await setDoc(doc(db, 'users', uid), { userID: uid, userState: role, userStatus: 0, dateCreated: past, name: uid });
    }
    await setDoc(doc(db, 'users', 'alias-admin'), { userID: 'alias-admin', userStatus: 1, dateCreated: past, name: 'Legacy admin' });
    await setDoc(doc(db, 'users', 'demoted-owner'), { userID: 'demoted-owner', userState: 0, userStatus: 2, dateCreated: past });
    await setDoc(doc(db, 'users', 'invalid-role'), { userID: 'invalid-role', userState: '2', userStatus: 2, dateCreated: past });
    await setDoc(doc(db, 'deals', 'existing'), deal('user', { dateSubmitted: past }));
    await setDoc(doc(db, 'deals', 'legacy'), { link: 'https://example.com/legacy', dateSubmitted: past, dateApproved: null });
    await setDoc(doc(db, 'wishlist', 'other-private'), wishlist('admin', { dateCreated: past }));
    await setDoc(doc(db, 'wishlist', 'legacy-numeric'), { name: 'Legacy item', link: '', userID: 26 });
  });

  await check('public deal and user reads remain available', async () => {
    await assertSucceeds(getDoc(doc(anonymous, 'deals', 'existing')));
    await assertSucceeds(getDocs(collection(anonymous, 'users')));
  });
  await check('anonymous writes are denied', async () => {
    await assertFails(setDoc(doc(anonymous, 'deals', 'anon'), deal('anonymous')));
    await assertFails(setDoc(doc(anonymous, 'wishlist', 'anon'), wishlist('anonymous')));
  });
  await check('regular user creates a pending self-attributed deal', async () => {
    await assertSucceeds(setDoc(doc(contexts.user, 'deals', 'user-pending'), deal('user')));
    await assertSucceeds(setDoc(doc(contexts.user, 'deals', 'user-metadata'), deal('user', {
      title: 'Product', description: 'Saved description', imageUrl: 'https://example.com/image.jpg', price: 12.5, currency: 'USD',
    })));
  });
  await check('regular user cannot approve, deny, spoof author, seed votes, or backdate', async () => {
    for (const [name, overrides] of [
      ['approve', { status: 'approved', dateApproved: serverTimestamp() }],
      ['deny', { status: 'denied' }], ['author', { userID: 'admin' }],
      ['votes', { upvotes: 8 }], ['backdate', { dateSubmitted: past }],
      ['approval-date', { dateApproved: past }], ['extra', { userStatus: 2 }],
    ]) await assertFails(setDoc(doc(contexts.user, 'deals', `user-${name}`), deal('user', overrides)));
  });
  await check('missing profile defaults to regular-user permissions', async () => {
    await assertSucceeds(setDoc(doc(contexts['new-user'], 'deals', 'unprofiled-pending'), deal('new-user')));
    await assertFails(setDoc(doc(contexts['new-user'], 'deals', 'unprofiled-approved'), deal('new-user', { status: 'approved', dateApproved: serverTimestamp() })));
  });
  await check('admin may set approval but keeps automatic submission fields', async () => {
    await assertSucceeds(setDoc(doc(contexts.admin, 'deals', 'admin-approved'), deal('admin', { status: 'approved', dateApproved: serverTimestamp() })));
    await assertSucceeds(setDoc(doc(contexts.admin, 'deals', 'admin-denied'), deal('admin', { status: 'denied' })));
    for (const [name, overrides] of [['author', { userID: 'user' }], ['votes', { upvotes: 2 }], ['backdate', { dateSubmitted: past }], ['approval-time', { status: 'approved', dateApproved: past }]]) {
      await assertFails(setDoc(doc(contexts.admin, 'deals', `admin-${name}`), deal('admin', overrides)));
    }
  });
  await check('owner can override deal fields and legacy numeric author', async () => {
    await assertSucceeds(setDoc(doc(contexts.owner, 'deals', 'owner-full'), deal(26, {
      status: 'approved', dateApproved: past, dateSubmitted: past, upvotes: 9,
    })));
  });
  await check('all roles reject invalid deal shapes and inconsistent approval', async () => {
    for (const [name, overrides] of [
      ['url', { link: 'javascript:alert(1)' }], ['space-url', { link: 'https://example.com/a b' }],
      ['negative', { upvotes: -1 }], ['fraction', { upvotes: 1.5 }],
      ['status', { status: 'other' }], ['missing-approved-date', { status: 'approved' }],
      ['price-object', { price: { value: 5 } }],
    ]) await assertFails(setDoc(doc(contexts.owner, 'deals', `invalid-${name}`), deal('owner', overrides)));
  });
  await check('legacy roles work only when userState is absent', async () => {
    await assertSucceeds(setDoc(doc(contexts['alias-admin'], 'deals', 'alias-approve'), deal('alias-admin', { status: 'approved', dateApproved: serverTimestamp() })));
    for (const uid of ['demoted-owner', 'invalid-role']) {
      await assertFails(setDoc(doc(contexts[uid], 'deals', `${uid}-approve`), deal(uid, { status: 'approved', dateApproved: serverTimestamp() })));
      await assertSucceeds(setDoc(doc(contexts[uid], 'deals', `${uid}-pending`), deal(uid)));
    }
  });
  await check('regular users cannot change votes or approve existing deals', async () => {
    await assertFails(updateDoc(doc(contexts.user, 'deals', 'existing'), { upvotes: 1 }));
    await assertFails(updateDoc(doc(contexts.user, 'deals', 'existing'), { status: 'approved', dateApproved: serverTimestamp() }));
  });
  await check('admin approval changes only approval fields, including legacy deals', async () => {
    await assertSucceeds(updateDoc(doc(contexts.admin, 'deals', 'existing'), { status: 'approved', dateApproved: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(contexts.admin, 'deals', 'legacy'), { status: 'approved', dateApproved: serverTimestamp() }));
    await assertFails(updateDoc(doc(contexts.admin, 'deals', 'existing'), { upvotes: 8 }));
    await assertFails(updateDoc(doc(contexts.admin, 'deals', 'existing'), { userID: 'admin' }));
    await assertSucceeds(updateDoc(doc(contexts.owner, 'deals', 'owner-full'), { upvotes: 10 }));
  });
  await check('new profiles start as role zero with their own UID', async () => {
    await assertSucceeds(setDoc(doc(contexts['new-user'], 'users', 'new-user'), { userID: 'new-user', userState: 0, dateCreated: serverTimestamp(), name: 'New user', email: '' }));
    const legacySignup = environment.authenticatedContext('legacy-signup').firestore();
    await assertSucceeds(setDoc(doc(legacySignup, 'users', 'legacy-signup'), { userID: 'legacy-signup', userStatus: 0, dateCreated: serverTimestamp() }));
    const elevate = environment.authenticatedContext('self-elevate').firestore();
    for (const fields of [{ userState: 2 }, { userStatus: 2 }, { userState: 0, userStatus: 2 }, { userState: 2, userStatus: 0 }]) {
      await assertFails(setDoc(doc(elevate, 'users', 'self-elevate'), { userID: 'self-elevate', dateCreated: serverTimestamp(), ...fields }));
    }
    await assertFails(setDoc(doc(elevate, 'users', 'somebody-else'), { userID: 'somebody-else', userStatus: 0, dateCreated: serverTimestamp() }));
  });
  await check('profile edits preserve role, UID, and creation time', async () => {
    await assertSucceeds(updateDoc(doc(contexts.user, 'users', 'user'), { name: 'Updated name', username: 'updated-user' }));
    await assertFails(updateDoc(doc(contexts.user, 'users', 'user'), { userStatus: 2 }));
    await assertFails(updateDoc(doc(contexts.user, 'users', 'user'), { userState: 2 }));
    await assertFails(updateDoc(doc(contexts.user, 'users', 'user'), { userID: 'owner' }));
    await assertFails(updateDoc(doc(contexts.user, 'users', 'user'), { dateCreated: serverTimestamp() }));
    await assertFails(updateDoc(doc(contexts.admin, 'users', 'admin'), { userStatus: 2 }));
  });
  await check('owner may manage another profile role', async () => {
    await assertSucceeds(updateDoc(doc(contexts.owner, 'users', 'managed'), { userState: 1 }));
    await assertSucceeds(setDoc(doc(contexts.owner, 'users', 'managed-new'), { userID: 'managed-new', userState: 1, dateCreated: serverTimestamp() }));
  });
  await check('wishlist entries belong to the signed-in user', async () => {
    await assertSucceeds(setDoc(doc(contexts.user, 'wishlist', 'own-wishlist'), wishlist('user')));
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'spoof-wishlist'), wishlist('admin')));
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'wishlist-extra'), wishlist('user', { brand: 'Extra' })));
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'wishlist-overlong-name'), wishlist('user', { name: 'x'.repeat(201) })));
    await assertSucceeds(getDoc(doc(contexts.user, 'wishlist', 'own-wishlist')));
    await assertSucceeds(getDocs(query(collection(contexts.user, 'wishlist'), where('userID', '==', 'user'))));
    await assertFails(getDoc(doc(contexts.user, 'wishlist', 'other-private')));
    await assertFails(getDocs(collection(contexts.user, 'wishlist')));
  });
  await check('admins keep private wishlists private; owner can manage all', async () => {
    await assertSucceeds(setDoc(doc(contexts.admin, 'wishlist', 'admin-own'), wishlist('admin')));
    await assertFails(getDoc(doc(contexts.admin, 'wishlist', 'own-wishlist')));
    await assertFails(getDocs(collection(contexts.admin, 'wishlist')));
    await assertSucceeds(setDoc(doc(contexts.owner, 'wishlist', 'owner-for-other'), wishlist(26)));
    await assertSucceeds(getDocs(collection(contexts.owner, 'wishlist')));
    await assertSucceeds(getDoc(doc(contexts.owner, 'wishlist', 'legacy-numeric')));
  });
  await check('wishlist saves reference an existing deal', async () => {
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'missing-deal'), wishlist('user', { dealID: 'not-a-deal' })));
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'invalid-deal'), wishlist('user', { dealID: 'a/b' })));
    const record = wishlist('user');
    delete record.dealID;
    await assertFails(setDoc(doc(contexts.user, 'wishlist', 'no-deal-id'), record));
  });
  await check('repeated saves preserve ownership and deal identity', async () => {
    await assertSucceeds(setDoc(doc(contexts.user, 'wishlist', 'repeat-save'), wishlist('user')));
    await assertSucceeds(setDoc(doc(contexts.user, 'wishlist', 'repeat-save'), wishlist('user')));
    await assertFails(setDoc(doc(contexts.admin, 'wishlist', 'repeat-save'), wishlist('admin')));
    await assertFails(updateDoc(doc(contexts.user, 'wishlist', 'repeat-save'), { userID: 'admin', dateCreated: serverTimestamp() }));
    await assertFails(updateDoc(doc(contexts.user, 'wishlist', 'repeat-save'), { dealID: 'owner-full', dateCreated: serverTimestamp() }));
  });
  await check('wishlist removal affects only the users own saved items', async () => {
    await assertFails(deleteDoc(doc(anonymous, 'wishlist', 'own-wishlist')));
    await assertFails(deleteDoc(doc(contexts.admin, 'wishlist', 'own-wishlist')));
    await assertFails(deleteDoc(doc(contexts.user, 'wishlist', 'other-private')));
    await assertSucceeds(deleteDoc(doc(contexts.user, 'wishlist', 'own-wishlist')));
    await assertSucceeds(deleteDoc(doc(contexts.admin, 'wishlist', 'admin-own')));
    await assertSucceeds(deleteDoc(doc(contexts.owner, 'wishlist', 'legacy-numeric')));
    const originalDeal = await assertSucceeds(getDoc(doc(contexts.user, 'deals', 'existing')));
    assert.equal(originalDeal.exists(), true);
  });
  await check('only admins and owners can delete listings, and wishlist entries are preserved', async () => {
    await assertFails(deleteDoc(doc(anonymous, 'deals', 'existing')));
    await assertFails(deleteDoc(doc(contexts.user, 'deals', 'existing')));
    await assertFails(deleteDoc(doc(contexts['demoted-owner'], 'deals', 'existing')));
    await assertFails(deleteDoc(doc(contexts['invalid-role'], 'deals', 'existing')));
    const missingProfile = environment.authenticatedContext('missing-profile').firestore();
    await assertFails(deleteDoc(doc(missingProfile, 'deals', 'existing')));
    await assertSucceeds(deleteDoc(doc(contexts.admin, 'deals', 'existing')));
    await assertSucceeds(deleteDoc(doc(contexts.owner, 'deals', 'owner-full')));
    await assertSucceeds(deleteDoc(doc(contexts['alias-admin'], 'deals', 'legacy')));
    for (const id of ['existing', 'owner-full', 'legacy']) {
      const deletedDeal = await assertSucceeds(getDoc(doc(anonymous, 'deals', id)));
      assert.equal(deletedDeal.exists(), false);
    }
    const savedItem = await assertSucceeds(getDoc(doc(contexts.user, 'wishlist', 'repeat-save')));
    assert.equal(savedItem.exists(), true);
    assert.equal(savedItem.data().dealID, 'existing');
  });
  await check('even owners cannot delete account documents', async () => {
    await assertFails(deleteDoc(doc(contexts.owner, 'users', 'managed')));
  });
  console.log(`\n${passed} Firestore rules checks passed against demo-gatorbyte only.`);
} finally {
  await environment.cleanup();
}
