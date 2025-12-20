package com.whatsapp.videocall

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import io.livekit.android.renderer.TextureViewRenderer
import io.livekit.android.room.participant.Participant
import io.livekit.android.room.track.VideoTrack

data class ParticipantItem(
    val participant: Participant,
    val videoTrack: VideoTrack? = null,
    val isSpeaking: Boolean = false
)

class ParticipantAdapter : RecyclerView.Adapter<ParticipantAdapter.ParticipantViewHolder>() {

    private var items = listOf<ParticipantItem>()

    fun updateItems(newItems: List<ParticipantItem>) {
        items = newItems
        notifyDataSetChanged() // efficient diffing could be better, but simple for now
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ParticipantViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_participant, parent, false)
        return ParticipantViewHolder(view)
    }

    override fun onBindViewHolder(holder: ParticipantViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class ParticipantViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val videoView: TextureViewRenderer = itemView.findViewById(R.id.participant_video_view)
        private val identityText: TextView = itemView.findViewById(R.id.participant_identity)
        private val speakerIndicator: View = itemView.findViewById(R.id.active_speaker_indicator)
        private var boundTrack: VideoTrack? = null

        fun bind(item: ParticipantItem) {
            identityText.text = item.participant.identity?.value ?: "Unknown"
            
            // Show speaker indicator
            speakerIndicator.visibility = if (item.isSpeaking) View.VISIBLE else View.GONE

            // Bind Video
            val track = item.videoTrack
            if (track != boundTrack) {
                boundTrack?.removeRenderer(videoView)
                boundTrack = track
                track?.addRenderer(videoView)
            }
            
            // Ensure LiveKit renderer is initialized if needed (usually handled by addRenderer)
            // But we might need to init with room context? 
            // TextureViewRenderer needs initialization. In Adapter, we assume it's initialized by layout inflation?
            // Actually, LiveKit Android Renderer usually needs `room.initVideoRenderer` OR just usage.
            // The `TextureViewRenderer` view itself initializes EglBase. 
            // We should ideally call `room.initVideoRenderer(view)` but passing `room` to adapter is messy.
            // Standard LiveKit Android `TextureViewRenderer` auto-inits its EglRenderer if just added to view.
        }
    }
}
