// Utility functions for generating and sharing game over images

export interface GameOverData {
  scores: { [key: string]: number };
  players: { [key: string]: string };
  currentUserId: string;
}

export async function generateGameOverImage(data: GameOverData): Promise<Blob> {
  // Get the winner (highest score)
  const sortedScores = Object.entries(data.scores)
    .filter(([playerId]) => data.players[playerId])
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  const winner = sortedScores[0];
  const winnerName = winner ? data.players[winner[0]] : "Winner";
  const winnerScore = winner ? winner[1] : 0;

  // Prepare data for API
  const requestData = {
    scores: data.scores,
    players: data.players,
    winner_name: winnerName,
    winner_score: winnerScore.toString(),
    total_players: Object.keys(data.players).length.toString(),
  };

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/images/game-over`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("Error generating game over image:", error);
    throw error;
  }
}

export async function convertSvgToPng(svgBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 800;
    canvas.height = 600;

    img.onload = () => {
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert to PNG"));
        }
      }, "image/png");
    };

    img.onerror = () => reject(new Error("Failed to load SVG"));

    const svgUrl = URL.createObjectURL(svgBlob);
    img.src = svgUrl;
  });
}

export async function shareGameOverResults(data: GameOverData) {
  try {
    // Generate the image
    const svgBlob = await generateGameOverImage(data);
    const pngBlob = await convertSvgToPng(svgBlob);

    // Create a file for sharing
    const file = new File([pngBlob], "scribbl-game-results.png", {
      type: "image/png",
    });

    const winner = Object.entries(data.scores)
      .filter(([playerId]) => data.players[playerId])
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0];

    const winnerName = winner ? data.players[winner[0]] : "Winner";
    const shareText = `🎨 Just finished an epic Scribbl game! ${winnerName} won with ${winner?.[1] || 0} points! 🏆 Join us at scribbl.club`;

    // Try to share with both text and file
    if (navigator.share) {
      // First try sharing with both text and file
      if (navigator.canShare && navigator.canShare({ files: [file], text: shareText })) {
        await navigator.share({
          title: "Scribbl Game Results",
          text: shareText,
          files: [file],
        });
      } 
      // If that fails, try sharing just the file with title
      else if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareText, // Use shareText as title since text might not be supported with files
          files: [file],
        });
      }
      // If file sharing is not supported, share just the text
      else {
        await navigator.share({
          title: "Scribbl Game Results",
          text: shareText,
        });
      }
    } else {
      // Fallback: download the image and copy text to clipboard
      downloadImage(pngBlob, "scribbl-game-results.png");
      
      // Copy share text to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
    }
  } catch (error) {
    console.error("Error sharing game results:", error);
    // Silently handle errors - don't show error messages to user
  }
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getShareText(data: GameOverData): string {
  const winner = Object.entries(data.scores)
    .filter(([playerId]) => data.players[playerId])
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0];

  const winnerName = winner ? data.players[winner[0]] : "Winner";
  const winnerScore = winner ? winner[1] : 0;
  const totalPlayers = Object.keys(data.players).length;

  return `🎨 Just finished an epic Scribbl game! ${winnerName} won with ${winnerScore} points out of ${totalPlayers} players! 🏆 Join us at scribbl.club`;
}

export function getShareUrls(shareText: string, imageUrl?: string) {
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent("https://scribbl.club");
  
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodeURIComponent("Scribbl Game Results")}&summary=${encodedText}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
  };
} 