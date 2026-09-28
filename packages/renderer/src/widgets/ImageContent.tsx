import { sanitizeImageUrl } from "./sanitizeImageUrl";

export interface ImageContentProps {
  text?: string;
  src?: string;
}

export function ImageContent({ text, src }: ImageContentProps) {
  const safeSrc = sanitizeImageUrl(src);
  return (
    <div className="ms-content ms-image">
      {safeSrc ? <img className="ms-image-img" src={safeSrc} alt="" /> : <span className="ms-text">—</span>}
      {text && <span className="ms-text">{text}</span>}
    </div>
  );
}
