def generate_academic_id(cursor, batch_code: str) -> str:
    """
    Generate a sequential, non-duplicate academic ID for the given batch code.
    Example: if batch_code = 'TW' and the last ID is 'TW003', returns 'TW004'.
    universityId IS the academic ID — no separate column needed.
    """
    cursor.execute(
        "SELECT universityId FROM users "
        "WHERE universityId LIKE %s ORDER BY universityId DESC LIMIT 1",
        (f"{batch_code}%",),
    )
    last = cursor.fetchone()
    if last and last['universityId']:
        try:
            next_num = int(last['universityId'][len(batch_code):]) + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"{batch_code}{str(next_num).zfill(3)}"
