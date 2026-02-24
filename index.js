require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('Warkoplak Bot is Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Playlist music - Pastikan folder 'music' ada di root project
const playlist = [
    path.join(__dirname, 'music', '2.23AM.mp3'),
    path.join(__dirname, 'music', '3.03PM.mp3')
];
let currentIndex = 0;

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} siap nongkrong di Warkoplak!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- FITUR PENJAGA ---
    if (message.content === '!penjaga') {
        const channel = message.member?.voice.channel;
        if (!channel) return message.reply("Masuk ke Voice Channel dulu, Bos!");
        
        connectToVoice(channel);
        message.reply(`🛡️ **Otw!** Aku jagain room **${channel.name}** sambil putar musik.`);
    }

    // --- FITUR KELUAR ---
    if (message.content === '!keluar') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply("👋 Cabut dulu ya, jangan kangen!");
        } else {
            message.reply("Aku lagi nggak di room mana-mana, santai aja.");
        }
    }

    // --- FITUR AI (GROK) ---
    if (message.content.startsWith('!ai ')) {
        const prompt = message.content.slice(4);
        if (!process.env.GROK_API_KEY) return message.reply("API Key Grok belum dipasang di .env!");

        message.channel.sendTyping();

        try {
            const response = await axios.post('https://api.x.ai/v1/chat/completions', {
                model: "grok-beta",
                messages: [
                    { role: "system", content: "Kamu adalah asisten AI di server Discord Warkoplak. Gaya bicaramu santai, lucu, pakai bahasa gaul dikit, dan singkat saja kalau jawab., dan kamu bisa menjadi teman curhat dan searching singkat saja jika di tanya kamu siapa kamu adalah bot warkoplak dari FX Intelligence" },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const reply = response.data.choices[0].message.content;
            message.reply(reply);
        } catch (err) {
            console.error(err);
            message.reply("Duh, server AI-nya lagi pusing. Coba lagi nanti!");
        }
    }
});

function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false, // Penting: Biar bot tetep bisa 'denger' dan stabil di VC
        selfMute: false
    });

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    function playNextTrack() {
        const trackPath = playlist[currentIndex];
        // Pastikan file mp3-nya benar-benar ada di folder music
        const resource = createAudioResource(trackPath, { inlineVolume: true });
        
        // Set volume ke 0.3 (30%) biar cukup keras tapi nggak pecah
        resource.volume.setVolume(0.3); 

        player.play(resource);
        console.log(`🎵 Sekarang muter: ${path.basename(trackPath)}`);
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    playNextTrack();
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log("Lagu habis, ganti lagu berikutnya...");
        playNextTrack();
    });

    player.on('error', error => {
        console.error(`❌ Audio Error: ${error.message}`);
        playNextTrack(); 
    });
}

client.login(process.env.TOKEN);