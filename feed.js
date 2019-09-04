const Discord = require("discord.js");
const client = new Discord.Client();
const request = require("request");

var confToken = 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo';
const KameraadRoleId = '506183228206481428';
const CategorieId = '616400159483363338';
const FeedChId = '562042082408005642';
const PrivateChannelWelcomeMessage = 'Welkom in je eigen kanaal, {username}. Je kunt mensen toe voegen door het kanaal te bewerken en dan op Machtigingen te klikken. Kijk in de gepinde berichten in <#617717752958025728> voor meer informatie.';

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

var updatingChannels = [];
client.on("channelUpdate", async (oldChannel, newChannel) => {
    if (updatingChannels.indexOf(newChannel.id) > -1)
        return;
    
    if (channelIsInZelfOrganisatie(newChannel)) {
        // @everyone permissions zijn fixed:
        if (newChannel.permissionOverwrites.has(newChannel.guild.id)) {
		    await newChannel.overwritePermissions(newChannel.guild.id, {'VIEW_CHANNEL':false}).catch(console.log);
	    }
	    
        // Kameraden role mag niet gebruikt worden
        if (newChannel.permissionOverwrites.has(KameraadRoleId)) {
            await newChannel.permissionOverwrites.get(KameraadRoleId).delete().catch(console.log);
        }
        
        // Oranje rol mag niet gebruikt worden
        if (newChannel.permissionOverwrites.has('511945889502461964')) {
            await newChannel.permissionOverwrites.get('511945889502461964').delete().catch(console.log);
        }
    }
});

client.on("message", (message) => {
    if (!message.guild)
        return;
    
    if (!isBotAdmin(message.member))
        return;
    
    if (!message.content.startsWith("/")) {
        return;
    }
    
    let args = message.content.split(/\s+/);
    let command = args.shift();
    
    if (command == "/create_channels") {
        if (args[0] == 'IAmVerySure') {
            getMembersWithChannels(async function(userIDs) {
                let nSkip = 0;
                let nDo = 0;
                for(member of message.guild.roles.get(KameraadRoleId).members.array()) {
                    // Create channel for members without channel
                    if (userIDs.indexOf(member.user.id) == -1) {
                        await createMemberChannel(member);
                        nDo++;
                    } else
                        nSkip++;
                }
                message.author.send("Created channels for " + nDo + " KAMERADEN members, skipped for " + nSkip + " members").catch(console.log);
            });
        } else {
            message.author.send('Are you sure you want to create a new channel for everyone without their own channel? If so, type **/create_channels IAmVerySure** in the server you want to execute this command in.');
        }
    }
    
    else if (command == "/cleanup_db") {
        getMemberChannels(function(channels) {
            message.guild.fetchMembers().then(function() {
                let nCleanupM = 0;
                let nCleanupC = 0;
                for(userID in channels) {
                    let hasMember = message.guild.members.has(userID);
                    if (!hasMember) {
                        request.post('https://www.hettuig.nl/bot/delete_channel.php', {
                            form: { 'user' : userID }
                        });
                        nCleanupM++;
                        continue;
                    }
                    let hasChannel = message.guild.channels.has(channels[userID]);
                    if (!hasChannel) {
                        request.post('https://www.hettuig.nl/bot/delete_channel.php', {
                            form: { 'channel' : channels[userID] }
                        });
                        nCleanupC++;
                        continue;
                    }
                }
                message.author.send('Cleaned up ' + nCleanupM + ' members, ' + nCleanupC + ' channels').catch(console.log);
            }).catch(console.log);
        });
    }
    
    else if (command == "/get_known_channels") {
        getMemberChannels(function(channels) {
            message.guild.fetchMembers().then(function() {
                let buf = '';
                for(userID in channels) {
                    let member = message.guild.members.get(userID);
                    if (typeof member == 'undefined') {
                        buf += '@ ' + userID + ' undefined\n';
                        continue;
                    }
                    let channel = message.guild.channels.get(channels[userID]);
                    if (typeof channel == 'undefined') {
                        buf += '# ' + channels[userID] + ' undefined\n';
                        continue;
                    }
                    buf += member.displayName + ': ' + channel.name + "\n";
                    if (buf.length > 1800) {
                        message.author.send(buf).catch(console.log);
                        buf = '';
                    }
                }
                message.author.send(buf).catch(console.log);                
            }).catch(console.log);
        });
    }
    
    else if (command == "/member_has_channel") {
        if (!args.length) {
            message.channel.send('Use /member_has_channel <@User>');
            message.delete();
        }
        let member = message.mentions.members.first();
        memberHasChannel(member, function(has) {
            message.author.send("Member " + member.user.username + " has " + (has ? 'a' : 'no') + ' channel.');
        });
    }
    
    else if (command == "/create_channel_for") {
        let args = message.content.split(/\s+/);
        args.shift();
        if (!args.length) {
            message.channel.send('Use /create_channel_for <@User>');
            message.delete();
        }
        let member = message.mentions.members.first();
        createMemberChannel(member);
    }
    
    // Unknown command
    else return;
    
    message.delete().catch(console.log);
});

function memberHasChannel(member, callback) {
    request.get('https://www.hettuig.nl/bot/has_channel.php?user=' + member.user.id, function(e, s, b) {
        callback(b.toUpperCase() == 'TRUE');
    });
}

function getMemberChannels(callback) {
    request.get('https://www.hettuig.nl/bot/channels.json', function(e, s, b) {
        let o = JSON.parse(b);
        callback(o);
    });
}

function getMembersWithChannels(callback) {
    request.get('https://www.hettuig.nl/bot/users_with_channels.php', function(e, s, b) {
        let userIDs = b.split(/\s+/);
        callback(userIDs);
    });
}

function createMemberChannel(member) {
    let chName = member.user.username.toLowerCase().replace(/[^a-z]+/, '-');
    let zelfOrgId = -1;
    for(ch2 of member.guild.channels.array()) {
        if (channelIsZelfOrganisatieCategory(ch2)) {
            if(ch2.children.size < 50) {
                zelfOrgId = ch2.id;
                break;
            }
        }
    }
    if (zelfOrgId == -1) {
        console.log('COULD NOT FIND CATEGORY zelforganisatie FOR @' + member.user.username);
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
        ch.send(
            PrivateChannelWelcomeMessage
            .replace('{mention}', '<@' + member.user.id + '>')
            .replace('{username}', member.displayName)
        )
        .catch(console.log);
        
        request.post('https://www.hettuig.nl/bot/save_channel.php', {
            form: {
                'user': member.user.id,
                'channel': ch.id
            }
        });
    }).catch(console.log);
}

client.on('message', msg => {
    var minlenght = 200;
    if (msg.channel.name == 'theorie' && msg.content.length < minlenght && !(msg.content.startsWith('https://') || msg.content.startsWith('http://'))) {
        msg.author.send('Ik heb je bericht in #theorie automatisch verwijderd, omdat het onder de minimale berichtlengte van ' + minlenght + ' karakters was.');
        msg.delete();
    }
});

client.on('channelDelete', (channel) => {
    request.post('https://www.hettuig.nl/bot/delete_channel.php', {
        form: { 'channel': channel.id }
    });
});

client.login(confToken);

function channelIsInZelfOrganisatie(ch) {
    return ch.parent && channelIsZelfOrganisatieCategory(ch.parent);
}

function channelIsZelfOrganisatieCategory(ch) {
    return ch.type == 'category' && ch.name.toLowerCase().startsWith('zelforganisatie');
}

function isBotAdmin(member) {
    return member.hasPermission('MANAGE_GUILD') || member.user.id == '146312749146701824';
}

function sendEmbed(server, msg, pinner) {
    let channel = server.channels.get(FeedChId);
    if (typeof channel == 'undefined') {
	    console.log("COULDNT FIND #feed (" + client.guilds.get(serverId).name + ")");
        return;
    }
    var embed = new Discord.RichEmbed();
    embed.setAuthor(msg.member.displayName, msg.author.avatarURL);
    embed.setDescription(msg.content);
    embed.setTitle('Message in #' + msg.channel.name + ' pinned by ' + pinner);
    
    var url = "https://discordapp.com/channels/" + msg.guild.id + "/" + msg.channel.id + "/" + msg.id;
    channel.send(url, embed);
}
