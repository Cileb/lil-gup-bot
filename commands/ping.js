//helper class
const { SlashCommandBuilder } = require("discord.js")

//so index can use
module.exports = {
    //what the command is named and it's purpose
    data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Is the bot alive?"),

    //what happens when someone uses '/ping' in the server
    async execute(interaction) {
        const latencyMs = Math.round(interaction.client.ws.ping);
        await interaction.reply(`Latency: ${latencyMs}ms`);
    },

};