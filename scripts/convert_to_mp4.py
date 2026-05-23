import os
import sys
import subprocess
import argparse
from pathlib import Path

def convert_to_mp4(input_path: str, output_path: str = None):
    input_file = Path(input_path).resolve()
    
    if not input_file.exists():
        print(f"Error: Input file '{input_file}' does not exist.")
        sys.exit(1)
        
    if output_path:
        output_file = Path(output_path).resolve()
    else:
        output_file = input_file.with_suffix('.mp4')

    print(f"Converting '{input_file.name}' to extremely high quality MP4...")
    
    # FFmpeg command for maximum quality and best compatibility
    ffmpeg_cmd = [
        'ffmpeg',
        '-y',                  # Overwrite output file
        '-i', str(input_file), # Input file
        '-map', '0:v:0?',      # Map video stream (if exists)
        '-map', '0:a:0?',      # Map audio stream (if exists)
        
        # Video settings (High Quality)
        '-c:v', 'libx264',
        '-preset', 'slow',     # Slow preset for better compression efficiency
        '-crf', '14',          # CRF 14 is virtually lossless
        '-profile:v', 'high',
        '-level', '4.2',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
        '-pix_fmt', 'yuv420p', # For massive compatibility
        
        # Audio settings
        '-c:a', 'aac',
        '-b:a', '320k',        # High quality audio
        '-ar', '48000',
        '-ac', '2',
        
        # Container
        '-movflags', '+faststart', # Web optimization
        str(output_file)
    ]
    
    try:
        # Run FFmpeg and stream output to console
        subprocess.run(ffmpeg_cmd, check=True)
        print("\n" + "="*50)
        print(f"SUCCESS! Created high-quality MP4: {output_file.name}")
        print("="*50 + "\n")
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] FFmpeg failed with exit code {e.returncode}")
        print("Please ensure 'ffmpeg' is installed and added to your system PATH.")
        sys.exit(e.returncode)
    except FileNotFoundError:
        print("\n[ERROR] 'ffmpeg' command not found.")
        print("You must install FFmpeg to use this script.")
        print("Download from: https://ffmpeg.org/download.html")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Convert high-quality WebM to MP4 using FFmpeg.")
    parser.add_argument("input", nargs="?", help="Path to the input .webm file. If omitted, converts all .webm files in the current folder.")
    parser.add_argument("-o", "--output", help="Optional explicit output path for a single file.")
    
    args = parser.parse_args()
    
    if args.input:
        convert_to_mp4(args.input, args.output)
    else:
        # Batch convert all .webm files in the current directory
        webm_files = list(Path('.').glob('*.webm'))
        if not webm_files:
            print("No .webm files found in the current directory.")
            print("Usage: python convert_to_mp4.py <input_file.webm>")
            sys.exit(0)
            
        print(f"Found {len(webm_files)} .webm files. Beginning batch conversion...")
        for webm in webm_files:
            convert_to_mp4(str(webm))

if __name__ == "__main__":
    main()
