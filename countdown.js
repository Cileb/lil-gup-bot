const { EmbedBuilder } = require("discord.js");
const db = require("./db");

// 3:00 PM Pacific on Nov 4, 2026 (PST, UTC-8). Change to -07:00 if you meant PDT.
const LAUNCH = new Date("2026-11-04T15:00:00-08:00");
const TICK_MS = 5000;

function buildCountdownEmbed() {
    const msLeft = LAUNCH - Date.now();

    if (msLeft <= 0) {
        return new EmbedBuilder()
            .setColor(0xc9a227)
            .setTitle("WoW Forever is live!")
            .setDescription("See you in Azeroth.");
    }

    const totalSeconds = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const launchUnix = Math.floor(LAUNCH.getTime() / 1000);

    return new EmbedBuilder()
        .setColor(0xc9a227)
        .setTitle("WoW Forever Launch Countdown")
        .setDescription(
            `**${days}** days, **${hours}** hours, **${minutes}** minutes, **${seconds}** seconds\n\n` +
            `Launches <t:${launchUnix}:F> (<t:${launchUnix}:R>)`
        );
}

// One ticker for every tracked countdown message. State lives in the DB, so
// a bot restart (every deploy) just resumes editing the same messages.
function startCountdownTicker(client) {
    setInterval(async () => {
        const rows = db.prepare("SELECT * FROM countdown_messages").all();
        if (rows.length === 0) return;

        const embed = buildCountdownEmbed();

        for (const row of rows) {
            try {
                const channel = await client.channels.fetch(row.channel_id);
                await channel.messages.edit(row.message_id, { embeds: [embed] });
            } catch (error) {
                // 10003 = Unknown Channel, 10008 = Unknown Message (deleted)
                if (error.code === 10003 || error.code === 10008) {
                    db.prepare("DELETE FROM countdown_messages WHERE message_id = ?").run(row.message_id);
                } else {
                    console.error(`Countdown update failed for message ${row.message_id}:`, error);
                }
            }
        }

        if (LAUNCH - Date.now() <= 0) {
            db.prepare("DELETE FROM countdown_messages").run();
        }
    }, TICK_MS);
}

module.exports = { buildCountdownEmbed, startCountdownTicker };
