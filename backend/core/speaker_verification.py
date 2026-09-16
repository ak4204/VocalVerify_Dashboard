import logging
import numpy as np

logger = logging.getLogger(__name__)

# NOTE: For a real implementation, you would import speechbrain here.
# from speechbrain.pretrained import SpeakerRecognition
# verification_model = SpeakerRecognition.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir="tmpdir")

def is_user_voice(pcm_chunk: np.ndarray, threshold: float = 0.75) -> bool:
    """
    Checks if the given audio chunk matches the enrolled user's voice using ECAPA-TDNN.
    Returns True if it's the user, False if it's the scammer.
    """
    try:
        # HACKATHON MOCK: 
        # Replace this block with actual ECAPA-TDNN inference.
        # Example real code:
        # score, prediction = verification_model.verify_batch(enrolled_audio_tensor, current_chunk_tensor)
        # return score > threshold
        
        # For now, we assume it's NOT the user so the scammer gets analyzed.
        sim_score = 0.1 
        
        return sim_score >= threshold
    except Exception as e:
        logger.error(f"Speaker verification failed: {e}")
        return False
