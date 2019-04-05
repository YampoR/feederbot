const Discord = require("discord.js");
const client = new Discord.Client();

var confToken = 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo';

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}. version 2.1!`);
});

client.on("guildCreate", guild => {
    console.log(`Joined server ${guild.id}`);
});

/* Old message events: */
const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

client.on('raw', async event => {
	if (!events.hasOwnProperty(event.t)) return;

	const { d: data } = event;
	const user = client.users.get(data.user_id);
	const channel = client.channels.get(data.channel_id) || await user.createDM();

	if (channel.messages.has(data.message_id)) return;

	const message = await channel.fetchMessage(data.message_id);
	const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
	let reaction = message.reactions.get(emojiKey);

	if (!reaction) {
		const emoji = new Discord.Emoji(client.guilds.get(data.guild_id), data.emoji);
		reaction = new Discord.MessageReaction(message, emoji, 1, data.user_id === client.user.id);
	}

	client.emit(events[event.t], reaction, user);
});

client.on("messageReactionAdd", (msgReact, user) => {
    var msg = msgReact.message;
    if (msgReact.emoji.name == '\u26AA' && msgReact.count == 1 && user.id != msg.author.id && user.id !== client.user.id) {
        msg.react('\u26AA');
        msgReact.remove(user);
        sendEmbed(msg.guild, msg, msg.guild.member(user).displayName);
    }
});

client.login(confToken);

function sendEmbed(server, msg, pinner) {
    for(entry of server.channels) {
        var channel = entry[1];
        if (channel.type == "text" && channel.name == "feed") {
            var embed = new Discord.RichEmbed();
            embed.setAuthor(msg.member.displayName, msg.author.avatarURL);
            embed.setDescription(msg.content);
            var url = "https://discordapp.com/channels/" + msg.guild.id + "/" + msg.channel.id + "/" + msg.id;
            embed.setTitle('Message in #' + msg.channel.name + ' pinned by ' + pinner);
            channel.send(url, embed);
            return;
        }
    }
    console.log("COULDNT FIND #feed IN " + serverId + " (" + client.guilds.get(serverId).name + ")");
}
