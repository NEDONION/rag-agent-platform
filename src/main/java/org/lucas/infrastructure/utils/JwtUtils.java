package org.lucas.infrastructure.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import javax.crypto.SecretKey;

public class JwtUtils {

    // JWT signing key is read from an environment variable; startup fails if it is
    // missing, so the application never falls back to a predictable hard-coded key.
    // Generate a strong Base64 value, e.g.: openssl rand -base64 48
    private static final String jwtSecret = resolveSecret();

    private static String resolveSecret() {
        String secret = System.getenv("JWT_SECRET");
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET environment variable must be set");
        }
        return secret;
    }

    // token过期时间 - 24小时
    private static final long EXPIRATION_TIME = 24 * 60 * 60 * 1000;

    private static SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /** 生成JWT Token */
    public static String generateToken(String userId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + EXPIRATION_TIME);

        return Jwts.builder().subject(userId).issuedAt(now).expiration(expiryDate).signWith(getSigningKey()).compact();
    }

    /** 从token中获取用户ID */
    public static String getUserIdFromToken(String token) {
        Claims claims = Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token).getPayload();

        return claims.getSubject();
    }

    /** 验证token是否有效 */
    public static boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}