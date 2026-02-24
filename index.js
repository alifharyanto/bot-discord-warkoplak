require('dotenv').config(); // Memanggil file .env
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const express = require('express');
const path = require('path');

// --- 1. WEB SERVER UNTUK KEEP-ALIVE ---
const app = express();
app.get('/', (req, res) => res.send('Bot Penjaga is Online!'));
app.listen(process.env.PORT || 3000);

// --- 2. KONFIGURASI BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Playlist: Gunakan ./ agar mencari di dalam folder proyek
const playlist = [
    path.join(__dirname, 'music', '2.23AM.mp3'),
    path.join(__dirname, 'music', '3.03PM.mp3')
];
let currentIndex = 0;

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!penjaga') {
        const channel = message.member?.voice.channel;
        if (!channel) return message.reply("Kamu harus di dalam Voice Channel dulu!");

        connectToVoice(channel);
        message.reply(`🛡️ **Standby!** Memutar playlist penjaga di **${channel.name}**.`);
    }
});

function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    function playNextTrack() {
        const trackPath = playlist[currentIndex];
        console.log(`🎵 Sedang memutar: ${trackPath}`);

        const resource = createAudioResource(trackPath, { inlineVolume: true });
        
        // PENTING: Volume di discord.js voice menggunakan skala 0 sampai 1.
        // 1 = 100%. Jika kamu isi 20, suaranya akan pecah/rusak.
        // Gunakan 0.2 untuk volume 20%.
        resource.volume.setVolume(0.2); 

        player.play(resource);
        
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    playNextTrack();
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log("Lagu selesai, pindah ke lagu berikutnya...");
        playNextTrack();
    });

    connection.on('disconnected', () => {
        console.log("⚠️ Terputus! Mencoba menyambung kembali dalam 5 detik...");
        setTimeout(() => connectToVoice(channel), 5000);
    });

    player.on('error', error => {
        console.error(`❌ Error: ${error.message}`);
        playNextTrack(); 
    });
}

client.login(process.env.TOKEN);