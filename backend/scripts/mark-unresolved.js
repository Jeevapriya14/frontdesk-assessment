
// Usage:
// node scripts/mark-unresolved.js --threshold=30
// node scripts/mark-unresolved.js --threshold=60 --dry-run

const path = require('path');
const { argv } = require('process');

const argMap = {};
argv.slice(2).forEach(a => {
  const [k, v] = a.split('=');
  if (k.startsWith('--')) argMap[k.replace(/^--/, '')] = v === undefined ? true : v;
});

const thresholdMinutes = Number(argMap.threshold || 30);
const dryRun = !!argMap.dryRun || !!argMap['dry-run'] || !!argMap.dry_run;

(async function main() {
  try {
    const fb = require(path.join(__dirname, '..', 'src', 'firebase.js'));
    const db = fb.db;

    const cutoff = Date.now() - thresholdMinutes * 60 * 1000;
    const cutoffIso = new Date(cutoff).toISOString();

    console.log(`[mark-unresolved] threshold=${thresholdMinutes}min dryRun=${dryRun}`);
    console.log(`[mark-unresolved] marking help_requests created_at < ${cutoffIso}`);

    const q = db.collection('help_requests')
      .where('status', '==', 'PENDING')
      .where('created_at', '<', cutoffIso)
      .limit(500);

    const snap = await q.get();
    if (snap.empty) {
      console.log('No old pending requests found.');
      process.exit(0);
    }

    console.log(`Found ${snap.size} documents older than ${thresholdMinutes} minutes.`);

    const batch = db.batch();
    let count = 0;
    snap.forEach(doc => {
      const ref = db.collection('help_requests').doc(doc.id);
      if (!dryRun) {
        batch.update(ref, {
          status: 'UNRESOLVED',
          unresolved_at: new Date().toISOString(),
          unresolved_reason: `timeout:${thresholdMinutes}m`
        });
        count++;
      }
      console.log(` -> ${doc.id} (${doc.data().question_text || ''})`);
    });

    if (!dryRun) {
      await batch.commit();
      console.log(`Updated ${count} documents to UNRESOLVED.`);
    } else {
      console.log('Dry-run only; no writes performed.');
    }
    process.exit(0);
  } catch (err) {
    console.error('mark-unresolved error:', err);
    process.exit(2);
  }
})();
