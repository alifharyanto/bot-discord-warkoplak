require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('Bot Penjaga AI is Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Playlist music
const playlist = [
    path.join(__dirname, 'music', '2.23AM.mp3'),
    path.join(__dirname, 'music', '3.03PM.mp3')
];
let currentIndex = 0;

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- FITUR PENJAGA ---
    if (message.content === '!penjaga') {
        const channel = message.member?.voice.channel;
        if (!channel) return message.reply("Masuk ke Voice Channel dulu!");
        connectToVoice(channel);
        message.reply(`🛡️ **Standby!** Bot masuk ke **${channel.name}**.`);
    }

    // --- FITUR KELUAR ---
    if (message.content === '!keluar') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply("👋 Aku keluar dari Voice Channel. Sampai jumpa!");
        } else {
            message.reply("Aku lagi nggak di Voice Channel mana pun.");
        }
    }

    // --- FITUR AI (GROK) ---
    if (message.content.startsWith('!ai ')) {
        const prompt = message.content.slice(4);
        message.channel.sendTyping();

        try {
            const response = await axios.post('https://api.x.ai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile", // atau model ringan lainnya
                messages: [
                    { role: "system", content: "Kamu adalah asisten AI yang ramah di server Discord Warkoplak. Jawab dengan singkat, santai, gaul, asik, dan enak di ajak ngobrol sesuai dengan topik kamu bisa mengigat percakapan yg ringan sajaa bisa juga jadi teman curhat dan enak lah yang bikin orang nyaman berbicara dengan mu" },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiReply = response.data.choices[0].message.content;
            message.reply(aiReply);
        } catch (error) {
            console.error(error);
            message.reply("Maaf, otakku lagi loading... (Error API)");
        }
    }
});

function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false, // Diubah jadi false agar tidak deafen total
    });

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    function playNextTrack() {
        const trackPath = playlist[currentIndex];
        // Pastikan file ada sebelum diputar
        const resource = createAudioResource(trackPath, { inlineVolume: true });
        
        // Coba volume 0.5 (50%) dulu biar kedengeran
        resource.volume.setVolume(0.5); 

        player.play(resource);
        console.log(`🎵 Memutar: ${trackPath}`);
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    playNextTrack();
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        playNextTrack();
    });

    player.on('error', error => {
        console.error(`❌ Audio Error: ${error.message}`);
        playNextTrack();
    });
}

client.login(process.env.TOKEN);