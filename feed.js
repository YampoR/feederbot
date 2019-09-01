const Discord = require("discord.js");
const client = new Discord.Client();

var confToken = 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo';
const KameraadRoleId = '506183228206481428';
const CategorieId = '616400159483363338';
const PrivateChannelWelcomeMessage = 'Welkom in je eigen kanaal. Je kunt mensen toe voegen door het kanaal te bewerken en dan op Machtigingen te klikken.';

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
    if (msg.channel.parent && msg.channel.parent.name.toLowerCase() == 'zelforganisatie')
        return;
    if (msgReact.emoji.name == '\u26AA' && msgReact.count == 1 && user.id != msg.author.id && user.id !== client.user.id) {
        msg.react('\u26AA');
        msgReact.remove(user);
        sendEmbed(msg.guild, msg, msg.guild.member(user).displayName);
    }
});

client.on("guildMemberUpdate", (oldMember, newMember) => {
    if (oldMember.roles.has(KameraadRoleId))
        return;
    if (!newMember.roles.has(KameraadRoleId))
        return;
    createMemberChannel(newMember);
});

client.on("message", (message) => {
    if (!message.guild)
        return;
    
    if (message.content.startsWith("/create_channels")) {
        if (!message.member.hasPermission('MANAGE_GUILD')) {
            return;
        }
        if (message.content == '/create_channels IAmVerySure') {
            for(member of message.guild.roles.get(KameraadRoleId).members.array()) {
                createMemberChannel(member);
            }
        } else {
            message.channel.send('Are you sure you want to create a new channel for everyone, regardless of whether they already have a channel? If so, type **/create_channels IAmVerySure**');
        }
        message.delete();
    }
    
    if (message.content.startsWith("/create_channel_for ")) {
        if (!message.member.hasPermission('MANAGE_GUILD')) {
            return;
        }
        let args = message.content.split(/\s+/);
        args.shift();
        if (!args.length) {
            message.channel.send('Use /create_channel_for <@User>');
            message.delete();
        }
        let member = message.mentions.members.first();
        createMemberChannel(member);
        message.delete();
    }
});

function createMemberChannel(member) {
    let chName = member.user.username.toLowerCase().replace(/\s+/, '-');
    let zelfOrgId = -1;
    for(ch2 of member.guild.channels.array()) {
        if (ch2.type == 'category' && ch2.name.toLowerCase() == 'zelforganisatie') {
            zelfOrgId = ch2.id;
            break;
        }
    }
    if (zelfOrgId == -1) {
        console.log('COULD NOT FIND Category #zelforganisatie');
        return;
    }
    member.guild.createChannel(chName, { 
        type: 'TEXT',
        parent: zelfOrgId,
        permissionOverwrites: [
            {
                id: member.guild.id,
                deny: ['VIEW_CHANNEL']
            },
            {
                id: member.user.id,
                allow: ['MANAGE_CHANNELS', 'VIEW_CHANNEL', 'MANAGE_MESSAGES', 'MANAGE_ROLES']
            },
            {
                id: member.guild.me.user.id,
                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES']
            }
        ]
    }).then(function(ch) {
        ch.send(PrivateChannelWelcomeMessage).catch(console.log);
    }).catch(console.log);
}

client.on('message', msg => {
    var minlenght = 200;
    if (msg.channel.name == 'universiteit' && msg.content.length < minlenght && !(msg.content.startsWith('https://') || msg.content.startsWith('http://'))) {
        msg.author.send('Ik heb je bericht in #universiteit automatisch verwijderd, omdat het onder de minimale berichtlengte van ' + minlenght + ' karakters was.');
        msg.delete();
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
