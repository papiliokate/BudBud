const targetPath = 'bud-bud-game';
const videoFile = 'Bud Bud.mp4';
const exactTitle = 'Bud Bud';

const ts = Math.floor(Date.now() / 1000);
const videoUrl = `https://${targetPath}.web.app/${encodeURIComponent(videoFile)}?t=${ts}`;

const payload = {
    video_url: videoUrl,
    text: exactTitle,
    youtube_title: exactTitle,
    target_channel: 'all'
};

fetch('https://hooks.zapier.com/hooks/catch/27231889/ujm5mjh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(res => {
    if (!res.ok) throw new Error('Zapier webhook failed: ' + res.statusText);
    console.log('Webhook sent successfully!');
}).catch(err => {
    console.error(err);
    process.exit(1);
});
