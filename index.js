const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const express = require('express');

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

// Playlist: Masukkan nama file mp3 kamu di sini
const playlist = ['/music/2.23AM.mp3', '/music/3.03PM.mp3'];
let currentIndex = 0;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
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

    // Fungsi untuk memutar lagu berdasarkan index
    function playNextTrack() {
        const trackPath = playlist[currentIndex];
        console.log(`Sedang memutar: ${trackPath}`);

        const resource = createAudioResource(trackPath, { inlineVolume: true });
        
        // Volume kecil (0.05 = 5%). Bisa kamu ubah sesuai selera
        resource.volume.setVolume(20); 

        player.play(resource);
        
        // Update index untuk lagu berikutnya
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    // Mulai putaran pertama
    playNextTrack();
    connection.subscribe(player);

    // Event ketika lagu habis (Idle)
    player.on(AudioPlayerStatus.Idle, () => {
        console.log("Lagu selesai, pindah ke lagu berikutnya...");
        playNextTrack();
    });

    // Fitur Reconnect otomatis jika dc
    connection.on('disconnected', () => {
        console.log("Terputus! Mencoba menyambung kembali...");
        setTimeout(() => connectToVoice(channel), 5000);
    });

    // Menangani error agar bot tidak crash
    player.on('error', error => {
        console.error(`Error: ${error.message}`);
        playNextTrack(); // Jika error, coba putar lagu berikutnya
    });
}

client.login(process.env.TOKEN);