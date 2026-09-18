//pulling in secrets & libraries
require("dotenv").config(); 

//pulling in DB & cron package
const cron = require("node-cron")
const db = require("./db")

//used to scan commands folder and register into commands collection
const fs = require("node:fs")
const path = require("node:path")

//pulling commands out of discord package, grabbing discord bot auth token
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const TOKEN = process.env.DISCORD_TOKEN;


//parsing time, helper function
function parseTime(timeString){
    const match = timeString.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if(!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = match[3]?.toLowerCase();

    if(hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    if(meridiem === "pm" && hour !== 12) hour += 12;
    if(meridiem === "am" && hour === 12) hour = 0;
    if(!meridiem && hour > 23) return null;

    return {hour, minute};
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

//registering the cron job
function scheduleAnnouncementJob(row){
    const job = cron.schedule(
        row.cron_expression,
        async() => {
            if(new Date() > new Date(row.end_date)){ /* are we past the end date of the scheduled announcement?, stop job, delete announcement from DB */
                job.stop();
                db.prepare("DELETE FROM scheduled_announcements WHERE id = ?").run(row.id);
                return;
            }
            //send announcement
            try {
                const channel = await client.channels.fetch(row.channel_id);
                const roleMention = row.role_id ? `<@&${row.role_id}>\n` : "";
                await channel.send(`${roleMention}\n${row.message}`);
            }
            catch (error){
                console.error(`Error posting scheduled announcement (id ${row.id})`, error)
            }
        },
     {timezone: row.timezone}
    );

    return job;
}


//bot object creation
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

//announcement temp storage
const pendingAnnouncements = new Map();

//attaching a new collection to the client object (will host commands)
client.commands = new Collection();

//loading commands folder into collection
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`)
    } else {
        console.warn(`Skipped ${file}: missing "data" or "execute".`);
    }
}

//connecting to server
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag} (ID: ${readyClient.user.id})`)
});

//executing a command, anytime an interaction is triggered (slash command, button click, dropdown selection, etc.)
//async - needs to await response from discord
client.on(Events.InteractionCreate, async (interaction) => {

    //checking if slashCommand or not
    if (interaction.isChatInputCommand()){

    //looks up command, based off user input, matches to command in collection
    const command = client.commands.get(interaction.commandName);
    if(!command){
        console.warn(`No command matching ${interaction.commandName} was found`);
        return;
    }
    //tries to executes the script from the command in collection
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        const errorReply = { content: "There was an error running that command.", ephemeral: true}; //only user who runs the command sees the error (ephemeral)
        if (interaction.replied || interaction.deferred){
            await interaction.followUp(errorReply);
        }
        else{
            await interaction.reply(errorReply)
        }
    
    }
}   else if (interaction.isModalSubmit()){ /*modal input logic, gathering data from announce and posting message in channel*/
    if(interaction.customId === "announcement"){
        const message = interaction.fields.getTextInputValue("messageInput");
        const channels = interaction.fields.getSelectedChannels("channelSelect", true)
        const targetChannel = channels.first();
        const roles = interaction.fields.getSelectedRoles("roleSelect", false);
        const role = roles && roles.size > 0 ? roles.first() : null;

        pendingAnnouncements.set(interaction.user.id, {
            message,
            channelId: targetChannel.id,
            roleId: role ? role.id : null
        })

        const postNowButton = new ButtonBuilder()
        .setCustomId("announce_post_now")
        .setLabel("Post Now")
        .setStyle(ButtonStyle.Primary);

        const scheduleButton = new ButtonBuilder()
        .setCustomId("announce_schedule")
        .setLabel("Set Up Recurring Schedule")
        .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(postNowButton, scheduleButton);

        await interaction.reply({
            content: `Ready to post in ${targetChannel}${role ? ` (pinging ${role})` : ""}:\n\n${message}`,
            components: [row],
            ephemeral: true
        })

    } else if (interaction.customId === "announceSchedule"){
        const pending = pendingAnnouncements.get(interaction.user.id);
        if(!pending){
            await interaction.reply({
                content: "This announcement setup has expired. Please run /announce again.",
                ephemeral: true,
            });
        return;
        }

        const days = interaction.fields.getStringSelectValues("daysSelect");
        const timeString = interaction.fields.getTextInputValue("timeInput");
        const weeksString = interaction.fields.getTextInputValue("weeksInput");
        const timezone = interaction.fields.getStringSelectValues("timezoneSelect")[0];

        const parsedTime = parseTime(timeString);
        const weeks = parseInt(weeksString, 10);

        //checking if valid inputs provided (time and weeks)
        if(!parsedTime){
            await interaction.reply({
                content: `"${timeString}" doesn't look like a valid time. Try something like 1:00pm or 2:00am.`,
                ephemeral: true,
            })
            return;
        }

        if(!Number.isInteger(weeks) || weeks < 1 ){
            await interaction.reply({
                content: `"${weeksString}" isn't a valid number of weeks. Enter a whole number, like 4.`,
                ephemeral: true,
            })
            return;
        }

        //building cron job variables
        const cronExpression = `${parsedTime.minute} ${parsedTime.hour} * * ${days.join(",")}`;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + weeks * 7);

        const result = db
        .prepare(
          `INSERT INTO scheduled_announcements (guild_id, channel_id, role_id, message, cron_expression, timezone, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          interaction.guild.id,
          pending.channelId,
          pending.roleId,
          pending.message,
          cronExpression,
          timezone,
          endDate.toISOString()
        );

        //runnning the announcement job
        const row = db.prepare("SELECT * FROM scheduled_announcements where id = ?").get(result.lastInsertRowid);
        scheduleAnnouncementJob(row);

        const dayNames = days.map((day) => DAY_NAMES[parseInt(day, 10)]).join(", ");

        await interaction.reply({
            content: `Recurring announcement scheduled!\nIt'll post at ${timeString} (${timezone}) on the day(s): ${dayNames} for the next ${weeks} week(s).`,
            ephemeral: true,
        })

    }
}   else if (interaction.isButton()){
    if(interaction.customId === "announce_post_now"){
        const pending = pendingAnnouncements.get(interaction.user.id);
        if(!pending){
            await interaction.update({
                content: "This announcement setup has expired. Please run /announce again.",
                components: [],
            });
        return;
        }

        const channel = await interaction.guild.channels.fetch(pending.channelId);
        const roleMention = pending.roleId ? `<@&${pending.roleId}>` : "";
        const announcementText = `${roleMention}\n${pending.message}`;

        await channel.send(announcementText);
        pendingAnnouncements.delete(interaction.user.id);

        await interaction.update({
            content: `Announcement posted in ${channel}.`,
            components: [],
    })
}
        else if (interaction.customId === "announce_schedule"){
          const pending = pendingAnnouncements.get(interaction.user.id);
            if(!pending){
            await interaction.update({
                content: "This announcement setup has expired. Please run /announce again.",
                components: [],
            });
            return;
        }

        const modal = new ModalBuilder()
        .setCustomId("announceSchedule")
        .setTitle("Recurring Schedule");

        const daysSelect = new StringSelectMenuBuilder()
        .setCustomId("daysSelect")
        .setMinValues(1)
        .setMaxValues(7)
        .setRequired(true)
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel("Sunday").setValue("0"),
            new StringSelectMenuOptionBuilder().setLabel("Monday").setValue("1"),
            new StringSelectMenuOptionBuilder().setLabel("Tuesday").setValue("2"),
            new StringSelectMenuOptionBuilder().setLabel("Wednesday").setValue("3"),
            new StringSelectMenuOptionBuilder().setLabel("Thursday").setValue("4"),
            new StringSelectMenuOptionBuilder().setLabel("Friday").setValue("5"),
            new StringSelectMenuOptionBuilder().setLabel("Saturday").setValue("6")
        );

        const daysLabel = new LabelBuilder()
        .setLabel("Repeat On")
        .setStringSelectMenuComponent(daysSelect);

        const timeInput = new TextInputBuilder()
        .setCustomId("timeInput")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

        const timeLabel = new LabelBuilder()
        .setLabel("Time")
        .setDescription("24-hour or 12-hour with am/pm, e.g. 15:00 or 3:00pm")
        .setTextInputComponent(timeInput);

        const weeksInput = new TextInputBuilder()
        .setCustomId("weeksInput")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 8")
        .setRequired(true);

        const weeksLabel = new LabelBuilder()
        .setLabel("Repeat for how many weeks?")
        .setDescription("The schedule stops automatically after this many weeks")
        .setTextInputComponent(weeksInput);

        const timezoneSelect = new StringSelectMenuBuilder()
        .setCustomId("timezoneSelect")
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("Eastern (ET)").setValue("America/New_York"),
          new StringSelectMenuOptionBuilder().setLabel("Central (CT)").setValue("America/Chicago"),
          new StringSelectMenuOptionBuilder().setLabel("Mountain (MT)").setValue("America/Denver"),
          new StringSelectMenuOptionBuilder().setLabel("Pacific (PT)").setValue("America/Los_Angeles"),
          new StringSelectMenuOptionBuilder().setLabel("UTC").setValue("UTC")
        );

        const timezoneLabel = new LabelBuilder()
        .setLabel("Timezone")
        .setStringSelectMenuComponent(timezoneSelect)

        
        modal.addLabelComponents(daysLabel, timeLabel, timezoneLabel, weeksLabel );

        await interaction.showModal(modal);
    }       
}
})

//check if token exists, login
if(!TOKEN){
    throw new Error("DISCORD_TOKEN not set. Copy .env.example to .env and add your bot token.")
}
client.login(TOKEN)